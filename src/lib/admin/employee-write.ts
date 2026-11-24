import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { syncMemberClaims } from "@/lib/admin/member-claims";
import type { ServerActor } from "@/lib/auth/server-actor";
import {
  employeeDocPath,
  employeesPath,
  memberDocPath,
  userDocPath,
} from "@/lib/firebase/paths";
import { ROLE_PERMISSIONS } from "@/lib/permissions/defaults";
import { BUSINESS_ROLES, type BusinessRole } from "@/types/roles";

type WriteResult = { ok: true; id: string } | { ok: false; error: string; status: number };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: unknown) {
  const next = text(value);
  return next || null;
}

function asRole(value: unknown): BusinessRole {
  return BUSINESS_ROLES.includes(value as BusinessRole) ? (value as BusinessRole) : "EMPLOYEE";
}

function authError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
  if (code === "auth/email-already-exists") return "AUTH_EMAIL_EXISTS";
  if (code === "auth/invalid-email") return "INVALID_EMAIL";
  if (code === "auth/invalid-password" || code === "auth/weak-password") return "WEAK_PASSWORD";
  return "AUTH_CREATE_FAILED";
}

function canAssignRole(actor: ServerActor, role: BusinessRole, currentRole?: string | null) {
  if (actor.isSuperAdmin || actor.role === "BUSINESS_OWNER") return true;
  if (currentRole === "BUSINESS_OWNER" || role === "BUSINESS_OWNER") return false;
  return actor.isOwnerOrManager;
}

export async function createBusinessEmployee(input: {
  actor: ServerActor;
  businessId: string;
  data: Record<string, unknown>;
}): Promise<WriteResult> {
  const displayName = text(input.data.displayName) || `${text(input.data.firstName)} ${text(input.data.lastName)}`.trim();
  const email = text(input.data.email).toLowerCase();
  const password = typeof input.data.password === "string" ? input.data.password : "";
  const role = asRole(input.data.role);
  const status = text(input.data.status) === "INACTIVE" || input.data.active === false ? "INACTIVE" : "ACTIVE";

  if (!displayName) return { ok: false, error: "NAME_REQUIRED", status: 400 };
  if (!email) return { ok: false, error: "EMAIL_REQUIRED", status: 400 };
  if (!password) return { ok: false, error: "PASSWORD_REQUIRED", status: 400 };
  if (password.length < 6) return { ok: false, error: "WEAK_PASSWORD", status: 400 };
  if (!canAssignRole(input.actor, role)) return { ok: false, error: "FORBIDDEN", status: 403 };

  const db = getAdminDb();
  const auth = getAdminAuth();
  const existingEmp = await db.collection(employeesPath(input.businessId)).where("email", "==", email).limit(1).get();
  if (!existingEmp.empty) return { ok: false, error: "DUPLICATE_EMPLOYEE", status: 409 };

  const existingAuth = await auth.getUserByEmail(email).catch(() => null);
  if (existingAuth) return { ok: false, error: "AUTH_EMAIL_EXISTS", status: 409 };

  let uid = "";
  try {
    const created = await auth.createUser({
      email,
      password,
      displayName,
      disabled: status === "INACTIVE",
    });
    uid = created.uid;
  } catch (error) {
    return { ok: false, error: authError(error), status: 400 };
  }

  const now = new Date();
  try {
    await db.doc(userDocPath(uid)).set({
      email,
      displayName,
      phone: nullable(input.data.phone),
      photoUrl: null,
      platformRole: null,
      defaultBusinessId: input.businessId,
      locale: "he",
      isActive: status === "ACTIVE",
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    const empRef = db.doc(employeeDocPath(input.businessId, uid));
    await empRef.set({
      businessId: input.businessId,
      userId: uid,
      uid,
      name: displayName,
      firstName: text(input.data.firstName) || displayName,
      lastName: text(input.data.lastName),
      displayName,
      email,
      phone: nullable(input.data.phone),
      departmentId: nullable(input.data.departmentId),
      jobTitle: nullable(input.data.jobTitle),
      role,
      status,
      active: status === "ACTIVE",
      startDate: null,
      createdAt: now,
      updatedAt: now,
    });

    await db.doc(memberDocPath(input.businessId, uid)).set({
      userId: uid,
      businessId: input.businessId,
      employeeId: uid,
      role,
      permissions: ROLE_PERMISSIONS[role],
      email,
      displayName,
      isActive: status === "ACTIVE",
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    await db.doc(userDocPath(uid)).collection("memberships").doc(input.businessId).set({
      businessId: input.businessId,
      role,
      isActive: status === "ACTIVE",
    }, { merge: true });

    await syncMemberClaims({
      uid,
      businessId: input.businessId,
      role,
      employeeId: uid,
    });

    return { ok: true, id: uid };
  } catch {
    await auth.deleteUser(uid).catch(() => undefined);
    return { ok: false, error: "AUTH_CREATE_FAILED", status: 500 };
  }
}

export async function updateBusinessEmployee(input: {
  actor: ServerActor;
  businessId: string;
  id: string;
  data: Record<string, unknown>;
}): Promise<WriteResult> {
  if (!input.id) return { ok: false, error: "MISSING_ID", status: 400 };
  const db = getAdminDb();
  const empRef = db.doc(employeeDocPath(input.businessId, input.id));
  const empSnap = await empRef.get();
  if (!empSnap.exists) return { ok: false, error: "NOT_FOUND", status: 404 };

  const current = empSnap.data() ?? {};
  const displayName = text(input.data.displayName) || `${text(input.data.firstName)} ${text(input.data.lastName)}`.trim() || String(current.displayName ?? "");
  if (!displayName) return { ok: false, error: "NAME_REQUIRED", status: 400 };

  const currentRole = typeof current.role === "string" ? current.role : null;
  const role = text(input.data.role) ? asRole(input.data.role) : asRole(currentRole);
  if (!canAssignRole(input.actor, role, currentRole)) return { ok: false, error: "FORBIDDEN", status: 403 };

  const status = text(input.data.status) === "INACTIVE" || input.data.active === false ? "INACTIVE" : "ACTIVE";
  const uid = String(current.uid ?? current.userId ?? "");
  const now = new Date();

  await empRef.set({
    firstName: text(input.data.firstName) || displayName,
    lastName: text(input.data.lastName),
    displayName,
    name: displayName,
    phone: input.data.phone !== undefined ? nullable(input.data.phone) : current.phone ?? null,
    departmentId: input.data.departmentId !== undefined ? nullable(input.data.departmentId) : current.departmentId ?? null,
    jobTitle: input.data.jobTitle !== undefined ? nullable(input.data.jobTitle) : current.jobTitle ?? null,
    role,
    status,
    active: status === "ACTIVE",
    uid: uid || null,
    userId: uid || current.userId || null,
    updatedAt: now,
  }, { merge: true });

  if (uid) {
    await db.doc(userDocPath(uid)).set({
      displayName,
      phone: input.data.phone !== undefined ? nullable(input.data.phone) : undefined,
      isActive: status === "ACTIVE",
      ...(input.data.notifyInApp !== undefined ? { notifyInApp: input.data.notifyInApp !== false } : {}),
      ...(input.data.notifyEmail !== undefined ? { notifyEmail: input.data.notifyEmail !== false } : {}),
      updatedAt: now,
    }, { merge: true });
    await db.doc(memberDocPath(input.businessId, uid)).set({
      role,
      permissions: ROLE_PERMISSIONS[role],
      displayName,
      employeeId: input.id,
      isActive: status === "ACTIVE",
      updatedAt: now,
    }, { merge: true });
    await db.doc(userDocPath(uid)).collection("memberships").doc(input.businessId).set({
      role,
      isActive: status === "ACTIVE",
    }, { merge: true });
    await getAdminAuth().updateUser(uid, {
      displayName,
      disabled: status === "INACTIVE",
    }).catch(() => undefined);
    await syncMemberClaims({
      uid,
      businessId: input.businessId,
      role,
      employeeId: input.id,
    }).catch(() => undefined);
  }

  return { ok: true, id: input.id };
}

export async function resetBusinessEmployeePassword(input: {
  actor: ServerActor;
  businessId: string;
  id: string;
  password: unknown;
}): Promise<WriteResult> {
  if (!input.id) return { ok: false, error: "MISSING_ID", status: 400 };
  const password = typeof input.password === "string" ? input.password : "";
  if (!password) return { ok: false, error: "PASSWORD_REQUIRED", status: 400 };
  if (password.length < 6) return { ok: false, error: "WEAK_PASSWORD", status: 400 };

  const db = getAdminDb();
  const empSnap = await db.doc(employeeDocPath(input.businessId, input.id)).get();
  if (!empSnap.exists) return { ok: false, error: "NOT_FOUND", status: 404 };
  const current = empSnap.data() ?? {};
  const currentRole = typeof current.role === "string" ? current.role : null;
  if (!canAssignRole(input.actor, asRole(currentRole || "EMPLOYEE"), currentRole)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  const uid = String(current.uid ?? current.userId ?? "");
  if (!uid) return { ok: false, error: "NO_AUTH_USER", status: 400 };

  try {
    await getAdminAuth().updateUser(uid, { password });
  } catch (error) {
    return { ok: false, error: authError(error), status: 400 };
  }
  return { ok: true, id: input.id };
}
