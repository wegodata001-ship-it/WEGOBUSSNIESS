import { writeActivity } from "@/lib/admin/activity";
import type { ServerActor } from "@/lib/auth/server-actor";
import { getFirebaseWebApiKey } from "@/lib/env";
import { getAdminDb } from "@/lib/firebase/admin";
import { projectCredentialsDocPath, projectDocPath, userDocPath } from "@/lib/firebase/paths";
import {
  decryptProjectPassword,
  encryptProjectPassword,
  isProjectCredentialsEncryptionConfigured,
  type EncryptedProjectSecret,
} from "@/lib/security/project-credentials-crypto";

const REAUTH_WINDOW_MS = 15 * 60 * 1000;
const REAUTH_MAX_FAILURES = 5;

export function canManageProjectCredentials(actor: ServerActor) {
  return actor.isSuperAdmin || actor.role === "BUSINESS_OWNER";
}

export function projectCredentialsEncryptionStatus() {
  return { encryptionReady: isProjectCredentialsEncryptionConfigured() };
}

async function assertProjectExists(businessId: string, projectId: string) {
  const snap = await getAdminDb().doc(projectDocPath(businessId, projectId)).get();
  return snap.exists;
}

async function markPasswordConfigured(businessId: string, projectId: string, actorUid: string, configured: boolean) {
  const ref = getAdminDb().doc(projectDocPath(businessId, projectId));
  const snap = await ref.get();
  if (!snap.exists) return;
  const current = (snap.data()?.systemDetails && typeof snap.data()?.systemDetails === "object")
    ? { ...(snap.data()!.systemDetails as Record<string, unknown>) }
    : {};
  const secretRef = configured ? projectCredentialsDocPath(businessId, projectId) : null;
  await ref.set({
    systemDetails: {
      ...current,
      passwordConfigured: configured,
      passwordSecretRef: secretRef,
      updatedAt: new Date(),
      updatedByUserId: actorUid,
    },
    updatedAt: new Date(),
  }, { merge: true });
}

async function getGateRef(businessId: string, uid: string) {
  return getAdminDb().doc(`businesses/${businessId}/credentialGates/${uid}`);
}

export async function checkCredentialReauthGate(businessId: string, uid: string) {
  const ref = await getGateRef(businessId, uid);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true as const };
  const data = snap.data() || {};
  const windowStart = data.windowStart?.toDate?.() instanceof Date
    ? data.windowStart.toDate()
    : data.windowStart instanceof Date
      ? data.windowStart
      : null;
  const failures = typeof data.failures === "number" ? data.failures : 0;
  if (!windowStart || Date.now() - windowStart.getTime() > REAUTH_WINDOW_MS) {
    return { ok: true as const };
  }
  if (failures >= REAUTH_MAX_FAILURES) {
    return { ok: false as const, error: "TOO_MANY_ATTEMPTS" as const, status: 429 };
  }
  return { ok: true as const };
}

async function recordReauthFailure(businessId: string, uid: string) {
  const ref = await getGateRef(businessId, uid);
  const snap = await ref.get();
  const now = new Date();
  if (!snap.exists) {
    await ref.set({ failures: 1, windowStart: now, updatedAt: now });
    return;
  }
  const data = snap.data() || {};
  const windowStart = data.windowStart?.toDate?.() instanceof Date
    ? data.windowStart.toDate()
    : data.windowStart instanceof Date
      ? data.windowStart
      : now;
  const fresh = Date.now() - windowStart.getTime() > REAUTH_WINDOW_MS;
  await ref.set({
    failures: fresh ? 1 : (typeof data.failures === "number" ? data.failures : 0) + 1,
    windowStart: fresh ? now : windowStart,
    updatedAt: now,
  }, { merge: true });
}

async function clearReauthFailures(businessId: string, uid: string) {
  const ref = await getGateRef(businessId, uid);
  await ref.delete().catch(() => undefined);
}

/**
 * Re-verify the signed-in owner with their account password (Identity Toolkit).
 * Never logs the password.
 */
export async function verifyActorAccountPassword(input: {
  actor: ServerActor;
  accountPassword: unknown;
}) {
  const password = typeof input.accountPassword === "string" ? input.accountPassword : "";
  if (!password) return { ok: false as const, error: "REAUTH_REQUIRED" as const, status: 401 };

  const gate = await checkCredentialReauthGate(input.actor.businessId, input.actor.uid);
  if (!gate.ok) return gate;

  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) return { ok: false as const, error: "AUTH_CONFIGURATION_ERROR" as const, status: 503 };

  const userSnap = await getAdminDb().doc(userDocPath(input.actor.uid)).get();
  const email = typeof userSnap.data()?.email === "string" ? String(userSnap.data()?.email).trim() : "";
  if (!email) return { ok: false as const, error: "REAUTH_REQUIRED" as const, status: 401 };

  const tokenResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const tokens = (await tokenResponse.json().catch(() => ({}))) as {
    localId?: string;
    error?: { message?: string };
  };

  if (!tokens.localId || tokens.localId !== input.actor.uid) {
    await recordReauthFailure(input.actor.businessId, input.actor.uid);
    return { ok: false as const, error: "REAUTH_FAILED" as const, status: 401 };
  }

  await clearReauthFailures(input.actor.businessId, input.actor.uid);
  return { ok: true as const };
}

export async function getProjectCredentialStatus(input: {
  actor: ServerActor;
  businessId: string;
  projectId: string;
}) {
  if (!canManageProjectCredentials(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  if (!(await assertProjectExists(input.businessId, input.projectId))) {
    return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  }
  const snap = await getAdminDb().doc(projectCredentialsDocPath(input.businessId, input.projectId)).get();
  return {
    ok: true as const,
    encryptionReady: isProjectCredentialsEncryptionConfigured(),
    configured: snap.exists,
  };
}

export async function saveProjectCredential(input: {
  actor: ServerActor;
  businessId: string;
  projectId: string;
  password: unknown;
  accountPassword: unknown;
}) {
  if (!canManageProjectCredentials(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  if (!isProjectCredentialsEncryptionConfigured()) {
    return { ok: false as const, error: "ENCRYPTION_NOT_CONFIGURED" as const, status: 503 };
  }
  const password = typeof input.password === "string" ? input.password : "";
  if (!password || password.length > 256) {
    return { ok: false as const, error: "PASSWORD_REQUIRED" as const, status: 400 };
  }
  if (!(await assertProjectExists(input.businessId, input.projectId))) {
    return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  }

  const reauth = await verifyActorAccountPassword({
    actor: input.actor,
    accountPassword: input.accountPassword,
  });
  if (!reauth.ok) return reauth;

  const encrypted = encryptProjectPassword({
    plaintext: password,
    businessId: input.businessId,
    projectId: input.projectId,
  });
  if ("error" in encrypted) {
    return { ok: false as const, error: encrypted.error, status: 503 };
  }

  const now = new Date();
  const ref = getAdminDb().doc(projectCredentialsDocPath(input.businessId, input.projectId));
  const existed = (await ref.get()).exists;
  await ref.set({
    businessId: input.businessId,
    projectId: input.projectId,
    ...encrypted,
    updatedAt: now,
    updatedByUserId: input.actor.uid,
    ...(existed ? {} : { createdAt: now }),
  }, { merge: true });

  await markPasswordConfigured(input.businessId, input.projectId, input.actor.uid, true);
  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: existed ? "updateProjectCredential" : "saveProjectCredential",
    entityType: "project",
    entityId: input.projectId,
    message: existed ? "עודכנה סיסמת מערכת לפרויקט" : "נשמרה סיסמת מערכת לפרויקט",
  });

  return { ok: true as const, configured: true };
}

export async function revealProjectCredential(input: {
  actor: ServerActor;
  businessId: string;
  projectId: string;
  accountPassword: unknown;
}) {
  if (!canManageProjectCredentials(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  if (!isProjectCredentialsEncryptionConfigured()) {
    return { ok: false as const, error: "ENCRYPTION_NOT_CONFIGURED" as const, status: 503 };
  }
  if (!(await assertProjectExists(input.businessId, input.projectId))) {
    return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  }

  const reauth = await verifyActorAccountPassword({
    actor: input.actor,
    accountPassword: input.accountPassword,
  });
  if (!reauth.ok) return reauth;

  const snap = await getAdminDb().doc(projectCredentialsDocPath(input.businessId, input.projectId)).get();
  if (!snap.exists) return { ok: false as const, error: "NOT_CONFIGURED" as const, status: 404 };
  const data = snap.data() || {};
  if (data.businessId !== input.businessId || data.projectId !== input.projectId) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }

  const record: EncryptedProjectSecret = {
    ciphertext: String(data.ciphertext ?? ""),
    iv: String(data.iv ?? ""),
    authTag: String(data.authTag ?? ""),
    keyVersion: String(data.keyVersion ?? "v1"),
    algorithm: "aes-256-gcm",
  };
  const decrypted = decryptProjectPassword({
    record,
    businessId: input.businessId,
    projectId: input.projectId,
  });
  if (!decrypted.ok) {
    return { ok: false as const, error: decrypted.error, status: 500 };
  }

  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "revealProjectCredential",
    entityType: "project",
    entityId: input.projectId,
    message: "נחשפה סיסמת מערכת לפרויקט",
  });

  return { ok: true as const, password: decrypted.password };
}

export async function deleteProjectCredential(input: {
  actor: ServerActor;
  businessId: string;
  projectId: string;
  accountPassword: unknown;
}) {
  if (!canManageProjectCredentials(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  if (!(await assertProjectExists(input.businessId, input.projectId))) {
    return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  }

  const reauth = await verifyActorAccountPassword({
    actor: input.actor,
    accountPassword: input.accountPassword,
  });
  if (!reauth.ok) return reauth;

  await getAdminDb().doc(projectCredentialsDocPath(input.businessId, input.projectId)).delete().catch(() => undefined);
  await markPasswordConfigured(input.businessId, input.projectId, input.actor.uid, false);
  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "deleteProjectCredential",
    entityType: "project",
    entityId: input.projectId,
    message: "נמחקה סיסמת מערכת מהפרויקט",
  });
  return { ok: true as const, configured: false };
}
