import { writeActivity } from "@/lib/admin/activity";
import { sanitizeProjectSystemDetails, toProjectSystemDetails } from "@/lib/admin/project-system-rules";
import { actorCan, type ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { projectDocPath } from "@/lib/firebase/paths";

export function canManageProjectSystem(actor: ServerActor) {
  return actor.isSuperAdmin
    || actor.isOwnerOrManager
    || actorCan(actor, "projects.manage");
}

export function canViewProjectSystem(actor: ServerActor) {
  return canManageProjectSystem(actor)
    || actorCan(actor, "projects.view")
    || actorCan(actor, "tasks.view");
}

export async function updateProjectSystemDetails(input: {
  actor: ServerActor;
  businessId: string;
  projectId: string;
  data: Record<string, unknown>;
}) {
  if (!canManageProjectSystem(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN", status: 403 };
  }
  if (!input.projectId) return { ok: false as const, error: "MISSING_ID", status: 400 };

  const db = getAdminDb();
  const ref = db.doc(projectDocPath(input.businessId, input.projectId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND", status: 404 };

  const current = toProjectSystemDetails(snap.data()?.systemDetails);
  const sanitized = sanitizeProjectSystemDetails(input.data, current);
  if (!sanitized.ok) {
    return { ok: false as const, error: sanitized.error, status: 400 };
  }

  const now = new Date();
  const systemDetails = {
    ...sanitized.data,
    updatedAt: now,
    updatedByUserId: input.actor.uid,
  };
  await ref.set({ systemDetails, updatedAt: now }, { merge: true });
  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "updateProjectSystemDetails",
    entityType: "project",
    entityId: input.projectId,
    message: "עודכנו פרטי מערכת לפרויקט",
  });
  return { ok: true as const, id: input.projectId, systemDetails };
}

export async function addProjectMaintenanceLog(input: {
  actor: ServerActor;
  businessId: string;
  projectId: string;
  title: unknown;
  body: unknown;
}) {
  if (!canManageProjectSystem(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN", status: 403 };
  }
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false as const, error: "TITLE_REQUIRED", status: 400 };
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const db = getAdminDb();
  const projectRef = db.doc(projectDocPath(input.businessId, input.projectId));
  if (!(await projectRef.get()).exists) return { ok: false as const, error: "NOT_FOUND", status: 404 };

  const now = new Date();
  const ref = projectRef.collection("maintenanceLogs").doc();
  await ref.set({
    businessId: input.businessId,
    projectId: input.projectId,
    title,
    body,
    createdByUserId: input.actor.uid,
    createdByEmployeeId: input.actor.employeeId,
    createdAt: now,
  });
  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "addProjectMaintenanceLog",
    entityType: "project",
    entityId: input.projectId,
    message: `נוסף רשומת תחזוקה: ${title}`,
  });
  return { ok: true as const, id: ref.id };
}
