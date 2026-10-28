import { notifyEmployees, notifyUsers, taskHref } from "@/lib/admin/notify";
import { canAccessTaskChat, taskParticipantIds } from "@/lib/admin/task-access";
import { writeTaskActivity } from "@/lib/admin/task-activity";
import { loadTaskForActor } from "@/lib/admin/task-thread";
import { actorCan, type ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { toTaskAttachment, toTaskLink } from "@/lib/firebase/converters";
import {
  taskAttachmentDocPath,
  taskAttachmentsPath,
  taskCommentsPath,
  taskActivityPath,
  taskLinkDocPath,
  taskLinksPath,
  taskDocPath,
} from "@/lib/firebase/paths";

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/json",
]);

const ALLOWED_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "jpg", "jpeg", "png", "gif", "webp", "svg",
  "txt", "csv", "zip", "json",
]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function safeFileName(name: string) {
  return name.replace(/[^\w.\u0590-\u05ff\u0600-\u06ff-]+/g, "-").slice(0, 80) || "file";
}

export function isAllowedTaskFile(file: { name: string; type: string; size: number }) {
  if (file.size <= 0 || file.size > MAX_BYTES) return { ok: false as const, error: "FILE_TOO_LARGE" };
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_TYPES.has(file.type) || ALLOWED_EXT.has(ext)) return { ok: true as const };
  return { ok: false as const, error: "FILE_TYPE" };
}

export function parseHttpsUrl(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function canManageAsset(actor: ServerActor, uploadedByUserId: string) {
  return actor.isSuperAdmin
    || actor.isOwnerOrManager
    || actorCan(actor, "tasks.edit")
    || actorCan(actor, "tasks.delete")
    || actor.uid === uploadedByUserId;
}

async function notifyTaskFile(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  title: string;
  createdByUserId: string | null;
  participantIds: string[];
  fileName: string;
  attachmentId: string;
}) {
  await notifyEmployees({
    businessId: input.businessId,
    employeeIds: input.participantIds,
    skipUserIds: [input.actor.uid],
    title: `נוסף קובץ למשימה ${input.title}`,
    body: input.fileName,
    href: taskHref(input.taskId),
    type: "task.file",
    entityType: "task",
    entityId: input.taskId,
    channels: { inApp: true, email: false },
    dedupeKey: `TASK_FILE:${input.taskId}:${input.attachmentId}`,
  });
  if (input.createdByUserId && input.createdByUserId !== input.actor.uid) {
    await notifyUsers({
      businessId: input.businessId,
      userIds: [input.createdByUserId],
      skipUserIds: [input.actor.uid],
      title: `נוסף קובץ למשימה ${input.title}`,
      body: input.fileName,
      href: taskHref(input.taskId),
      type: "task.file",
      entityType: "task",
      entityId: input.taskId,
      channels: { inApp: true, email: false },
      dedupeKey: `TASK_FILE:${input.taskId}:${input.attachmentId}`,
    });
  }
}

export async function listTaskAttachments(actor: ServerActor, businessId: string, taskId: string) {
  const loaded = await loadTaskForActor(actor, businessId, taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const snap = await getAdminDb().collection(taskAttachmentsPath(businessId, taskId)).get();
  const attachments = snap.docs
    .map((docSnap) => toTaskAttachment(docSnap.id, docSnap.data()))
    .sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0));
  return { ok: true as const, attachments };
}

export async function uploadTaskAttachment(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  file: File;
  name?: string;
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  if (!canAccessTaskChat(input.actor, loaded.task)) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  const allowed = isAllowedTaskFile(input.file);
  if (!allowed.ok) return { ok: false as const, error: allowed.error, status: 400 };

  const db = getAdminDb();
  const ref = db.collection(taskAttachmentsPath(input.businessId, input.taskId)).doc();
  const fileName = safeFileName(input.file.name);
  const storagePath = `businesses/${input.businessId}/tasks/${input.taskId}/attachments/${ref.id}/${fileName}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  await getAdminStorage().bucket().file(storagePath).save(buffer, {
    contentType: input.file.type || "application/octet-stream",
    resumable: false,
  });
  const now = new Date();
  const displayName = text(input.name) || input.file.name;
  await ref.set({
    businessId: input.businessId,
    taskId: input.taskId,
    projectId: loaded.task.projectId ?? null,
    name: displayName,
    fileName: input.file.name,
    contentType: input.file.type || "application/octet-stream",
    size: input.file.size,
    storagePath,
    uploadedByUserId: input.actor.uid,
    uploadedByEmployeeId: input.actor.employeeId,
    createdAt: now,
    updatedAt: now,
  });
  await writeTaskActivity({
    businessId: input.businessId,
    taskId: input.taskId,
    actorUserId: input.actor.uid,
    actorEmployeeId: input.actor.employeeId,
    type: "file",
    message: `הועלה קובץ: ${displayName}`,
  });
  await notifyTaskFile({
    actor: input.actor,
    businessId: input.businessId,
    taskId: input.taskId,
    title: loaded.task.title,
    createdByUserId: loaded.task.createdByUserId,
    participantIds: taskParticipantIds(loaded.task),
    fileName: displayName,
    attachmentId: ref.id,
  });
  return { ok: true as const, id: ref.id };
}

export async function renameTaskAttachment(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  attachmentId: string;
  name: string;
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const name = text(input.name);
  if (!name) return { ok: false as const, error: "TASK_FIELDS" as const, status: 400 };
  const ref = getAdminDb().doc(taskAttachmentDocPath(input.businessId, input.taskId, input.attachmentId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  if (!canManageAsset(input.actor, String(snap.data()?.uploadedByUserId ?? ""))) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  await ref.set({ name, updatedAt: new Date() }, { merge: true });
  return { ok: true as const, id: input.attachmentId };
}

export async function deleteTaskAttachment(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  attachmentId: string;
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const ref = getAdminDb().doc(taskAttachmentDocPath(input.businessId, input.taskId, input.attachmentId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  if (!canManageAsset(input.actor, String(snap.data()?.uploadedByUserId ?? ""))) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  const storagePath = String(snap.data()?.storagePath ?? "");
  if (storagePath) {
    await getAdminStorage().bucket().file(storagePath).delete({ ignoreNotFound: true });
  }
  await ref.delete();
  await writeTaskActivity({
    businessId: input.businessId,
    taskId: input.taskId,
    actorUserId: input.actor.uid,
    actorEmployeeId: input.actor.employeeId,
    type: "file",
    message: `נמחק קובץ: ${String(snap.data()?.name ?? snap.data()?.fileName ?? "")}`,
  });
  return { ok: true as const, id: input.attachmentId };
}

export async function signedTaskAttachmentUrl(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  attachmentId: string;
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const snap = await getAdminDb().doc(taskAttachmentDocPath(input.businessId, input.taskId, input.attachmentId)).get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  const storagePath = String(snap.data()?.storagePath ?? "");
  if (!storagePath) return { ok: false as const, error: "NO_FILE" as const, status: 404 };
  const [signed] = await getAdminStorage().bucket().file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 15,
  });
  return { ok: true as const, url: signed, name: snap.data()?.fileName ?? snap.data()?.name, contentType: snap.data()?.contentType };
}

export async function listTaskLinks(actor: ServerActor, businessId: string, taskId: string) {
  const loaded = await loadTaskForActor(actor, businessId, taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const snap = await getAdminDb().collection(taskLinksPath(businessId, taskId)).get();
  const links = snap.docs
    .map((docSnap) => toTaskLink(docSnap.id, docSnap.data()))
    .sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0));
  return { ok: true as const, links };
}

export async function upsertTaskLink(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  linkId?: string;
  title: string;
  url: string;
  description?: string;
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const title = text(input.title);
  const url = parseHttpsUrl(input.url);
  if (!title || !url) return { ok: false as const, error: "INVALID_URL" as const, status: 400 };
  const db = getAdminDb();
  const now = new Date();
  if (input.linkId) {
    const ref = db.doc(taskLinkDocPath(input.businessId, input.taskId, input.linkId));
    const snap = await ref.get();
    if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
    if (!canManageAsset(input.actor, String(snap.data()?.createdByUserId ?? ""))) {
      return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
    }
    await ref.set({
      title,
      url,
      description: text(input.description),
      updatedAt: now,
    }, { merge: true });
    return { ok: true as const, id: input.linkId };
  }
  const ref = db.collection(taskLinksPath(input.businessId, input.taskId)).doc();
  await ref.set({
    businessId: input.businessId,
    taskId: input.taskId,
    projectId: loaded.task.projectId ?? null,
    title,
    url,
    description: text(input.description),
    createdByUserId: input.actor.uid,
    createdByEmployeeId: input.actor.employeeId,
    createdAt: now,
    updatedAt: now,
  });
  await writeTaskActivity({
    businessId: input.businessId,
    taskId: input.taskId,
    actorUserId: input.actor.uid,
    actorEmployeeId: input.actor.employeeId,
    type: "link",
    message: `נוסף קישור: ${title}`,
  });
  return { ok: true as const, id: ref.id };
}

export async function deleteTaskLink(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  linkId: string;
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const ref = getAdminDb().doc(taskLinkDocPath(input.businessId, input.taskId, input.linkId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  if (!canManageAsset(input.actor, String(snap.data()?.createdByUserId ?? ""))) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  await ref.delete();
  return { ok: true as const, id: input.linkId };
}

export async function cleanupTaskSubtree(businessId: string, taskId: string) {
  const db = getAdminDb();
  const [attachments, links, comments, activity] = await Promise.all([
    db.collection(taskAttachmentsPath(businessId, taskId)).get(),
    db.collection(taskLinksPath(businessId, taskId)).get(),
    db.collection(taskCommentsPath(businessId, taskId)).get(),
    db.collection(taskActivityPath(businessId, taskId)).get(),
  ]);
  const bucket = getAdminStorage().bucket();
  await Promise.all(attachments.docs.map(async (docSnap) => {
    const storagePath = String(docSnap.data().storagePath ?? "");
    if (storagePath) await bucket.file(storagePath).delete({ ignoreNotFound: true });
    await docSnap.ref.delete();
  }));
  await Promise.all([
    ...links.docs.map((docSnap) => docSnap.ref.delete()),
    ...comments.docs.map((docSnap) => docSnap.ref.delete()),
    ...activity.docs.map((docSnap) => docSnap.ref.delete()),
  ]);
  const reads = await db.collection(`${taskDocPath(businessId, taskId)}/reads`).get();
  await Promise.all(reads.docs.map((docSnap) => docSnap.ref.delete()));
}
