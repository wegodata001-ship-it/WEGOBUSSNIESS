import { writeActivity } from "@/lib/admin/activity";
import { isAllowedProjectSystemFile } from "@/lib/admin/project-system-rules";
import { canManageProjectSystem, canViewProjectSystem } from "@/lib/admin/project-system-write";
import { safeFileName } from "@/lib/admin/task-file-rules";
import type { ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { getAdminBucket } from "@/lib/firebase/admin-storage";
import {
  projectDocPath,
  projectMaintenanceLogsPath,
  projectSystemFileDocPath,
  projectSystemFilesPath,
} from "@/lib/firebase/paths";
import type { ProjectMaintenanceLog, ProjectSystemFile } from "@/types/project-system";

function isUploadedFile(value: unknown): value is File {
  if (typeof File !== "undefined" && value instanceof File) return value.size > 0;
  if (typeof Blob !== "undefined" && value instanceof Blob && "name" in value) {
    return (value as File).size > 0;
  }
  return false;
}

type DocData = Record<string, unknown> & {
  createdAt?: { toDate?: () => Date } | Date | null;
};

function asCreatedAt(value: DocData["createdAt"]) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  return null;
}

function toFile(id: string, data: DocData): ProjectSystemFile {
  return {
    id,
    businessId: String(data.businessId ?? ""),
    projectId: String(data.projectId ?? ""),
    name: String(data.name ?? ""),
    fileName: String(data.fileName ?? ""),
    contentType: String(data.contentType ?? ""),
    size: Number(data.size ?? 0),
    storagePath: String(data.storagePath ?? ""),
    uploadedByUserId: String(data.uploadedByUserId ?? ""),
    createdAt: asCreatedAt(data.createdAt),
  };
}

function toLog(id: string, data: DocData): ProjectMaintenanceLog {
  return {
    id,
    businessId: String(data.businessId ?? ""),
    projectId: String(data.projectId ?? ""),
    title: String(data.title ?? ""),
    body: String(data.body ?? ""),
    createdByUserId: String(data.createdByUserId ?? ""),
    createdByEmployeeId: typeof data.createdByEmployeeId === "string" ? data.createdByEmployeeId : null,
    createdAt: asCreatedAt(data.createdAt),
  };
}

async function ensureProject(businessId: string, projectId: string) {
  const snap = await getAdminDb().doc(projectDocPath(businessId, projectId)).get();
  return snap.exists;
}

export async function listProjectSystemFiles(actor: ServerActor, businessId: string, projectId: string) {
  if (!canViewProjectSystem(actor)) return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  if (!(await ensureProject(businessId, projectId))) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  const snap = await getAdminDb().collection(projectSystemFilesPath(businessId, projectId)).get();
  const files = snap.docs
    .map((docSnap) => toFile(docSnap.id, docSnap.data() as DocData))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  return { ok: true as const, files };
}

export async function listProjectMaintenanceLogs(actor: ServerActor, businessId: string, projectId: string) {
  if (!canViewProjectSystem(actor)) return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  if (!(await ensureProject(businessId, projectId))) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  const snap = await getAdminDb().collection(projectMaintenanceLogsPath(businessId, projectId)).get();
  const logs = snap.docs
    .map((docSnap) => toLog(docSnap.id, docSnap.data() as DocData))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  return { ok: true as const, logs };
}

export async function uploadProjectSystemFile(input: {
  actor: ServerActor;
  businessId: string;
  projectId: string;
  file: File;
  name?: string;
}) {
  if (!canManageProjectSystem(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  if (!isUploadedFile(input.file)) {
    return { ok: false as const, error: "FILE_REQUIRED" as const, status: 400 };
  }
  const allowed = isAllowedProjectSystemFile(input.file);
  if (!allowed.ok) return { ok: false as const, error: allowed.error, status: 400 };
  if (!(await ensureProject(input.businessId, input.projectId))) {
    return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  }

  const db = getAdminDb();
  const ref = db.collection(projectSystemFilesPath(input.businessId, input.projectId)).doc();
  const fileName = safeFileName(input.file.name);
  const storagePath = `businesses/${input.businessId}/projects/${input.projectId}/system/${ref.id}/${fileName}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  try {
    await getAdminBucket().file(storagePath).save(buffer, {
      contentType: input.file.type || "application/octet-stream",
      resumable: false,
    });
  } catch {
    return { ok: false as const, error: "STORAGE_FAILED" as const, status: 500 };
  }

  const now = new Date();
  const displayName = (input.name || "").trim() || input.file.name;
  try {
    await ref.set({
      businessId: input.businessId,
      projectId: input.projectId,
      name: displayName,
      fileName: input.file.name,
      contentType: input.file.type || "application/octet-stream",
      size: input.file.size,
      storagePath,
      uploadedByUserId: input.actor.uid,
      createdAt: now,
    });
  } catch {
    await getAdminBucket().file(storagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
    return { ok: false as const, error: "STORAGE_FAILED" as const, status: 500 };
  }

  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "uploadProjectSystemFile",
    entityType: "project",
    entityId: input.projectId,
    message: `הועלה קובץ מערכת: ${displayName}`,
  });
  return { ok: true as const, id: ref.id };
}

export async function deleteProjectSystemFile(input: {
  actor: ServerActor;
  businessId: string;
  projectId: string;
  fileId: string;
}) {
  if (!canManageProjectSystem(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  const ref = getAdminDb().doc(projectSystemFileDocPath(input.businessId, input.projectId, input.fileId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  const storagePath = String(snap.data()?.storagePath ?? "");
  if (storagePath) {
    await getAdminBucket().file(storagePath).delete({ ignoreNotFound: true });
  }
  await ref.delete();
  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "deleteProjectSystemFile",
    entityType: "project",
    entityId: input.projectId,
    message: "נמחק קובץ מערכת מהפרויקט",
  });
  return { ok: true as const };
}

export async function projectSystemFileDownloadUrl(input: {
  actor: ServerActor;
  businessId: string;
  projectId: string;
  fileId: string;
}) {
  if (!canViewProjectSystem(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  const snap = await getAdminDb().doc(projectSystemFileDocPath(input.businessId, input.projectId, input.fileId)).get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  const storagePath = String(snap.data()?.storagePath ?? "");
  if (!storagePath) return { ok: false as const, error: "NO_FILE" as const, status: 404 };
  const [signed] = await getAdminBucket().file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  });
  return { ok: true as const, url: signed };
}
