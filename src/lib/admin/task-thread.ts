import { notifyEmployees, notifyUsers, taskHref } from "@/lib/admin/notify";
import { canAccessTaskChat, taskParticipantIds } from "@/lib/admin/task-access";
import { writeTaskActivity } from "@/lib/admin/task-activity";
import { actorCan, type ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { toTask, toTaskActivity, toTaskComment } from "@/lib/firebase/converters";
import { toTimestamp } from "@/lib/dates/timestamp";
import { employeeDocPath, taskActivityPath, taskCommentsPath, taskDocPath, taskReadDocPath } from "@/lib/firebase/paths";

export type ThreadError = "FORBIDDEN" | "NOT_FOUND" | "TASK_FIELDS";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function loadTaskForActor(actor: ServerActor, businessId: string, taskId: string) {
  const db = getAdminDb();
  const snap = await db.doc(taskDocPath(businessId, taskId)).get();
  if (!snap.exists) return { error: "NOT_FOUND" as const };
  const task = toTask(snap.id, snap.data()!);
  if (!canAccessTaskChat(actor, task)) return { error: "FORBIDDEN" as const };
  return { task };
}

export async function listTaskThread(actor: ServerActor, businessId: string, taskId: string) {
  const loaded = await loadTaskForActor(actor, businessId, taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const db = getAdminDb();
  const [commentsSnap, activitySnap] = await Promise.all([
    db.collection(taskCommentsPath(businessId, taskId)).get(),
    db.collection(taskActivityPath(businessId, taskId)).get(),
  ]);
  const comments = commentsSnap.docs
    .map((docSnap) => toTaskComment(docSnap.id, docSnap.data()))
    .sort((left, right) => toTimestamp(left.createdAt) - toTimestamp(right.createdAt));
  const activity = activitySnap.docs
    .map((docSnap) => toTaskActivity(docSnap.id, docSnap.data()))
    .sort((left, right) => toTimestamp(left.createdAt) - toTimestamp(right.createdAt));
  const readSnap = await db.doc(taskReadDocPath(businessId, taskId, actor.uid)).get();
  const lastReadAt = toDateValue(readSnap.data()?.lastReadAt);
  const unreadCount = comments.filter((item) => {
    if (item.deletedAt) return false;
    if (item.authorUserId === actor.uid) return false;
    return toTimestamp(item.createdAt) > (lastReadAt?.getTime() ?? 0);
  }).length;
  return { ok: true as const, comments, activity, unreadCount, lastReadAt };
}

function toDateValue(value: unknown) {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }
  return null;
}

export async function addTaskComment(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  body: string;
  mentions?: string[];
  attachments?: Array<{ id?: string | null; name: string; url?: string | null }>;
  linkUrl?: string | null;
  linkTitle?: string | null;
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const body = text(input.body);
  const attachments = (input.attachments ?? []).filter((item) => item && item.name);
  const linkUrl = text(input.linkUrl) || null;
  const linkTitle = text(input.linkTitle) || null;
  if (!body && !attachments.length && !linkUrl) return { ok: false as const, error: "TASK_FIELDS" as const, status: 400 };

  const mentions = [...new Set((input.mentions ?? []).filter((id) => typeof id === "string" && id.trim()))];
  const db = getAdminDb();
  const now = new Date();
  const ref = await db.collection(taskCommentsPath(input.businessId, input.taskId)).add({
    businessId: input.businessId,
    taskId: input.taskId,
    authorUserId: input.actor.uid,
    authorEmployeeId: input.actor.employeeId,
    body,
    mentions,
    attachments,
    linkUrl,
    linkTitle,
    createdAt: now,
    updatedAt: now,
  });
  await db.doc(taskDocPath(input.businessId, input.taskId)).set({
    commentCount: (loaded.task.commentCount ?? 0) + 1,
    updatedAt: now,
  }, { merge: true });
  await writeTaskActivity({
    businessId: input.businessId,
    taskId: input.taskId,
    actorUserId: input.actor.uid,
    actorEmployeeId: input.actor.employeeId,
    type: "comment",
    message: "הוסיף/ה תגובה",
  });

  const actorName = input.actor.employeeId
    ? ((await db.doc(employeeDocPath(input.businessId, input.actor.employeeId)).get()).data()?.displayName as string | undefined)
    : undefined;

  if (mentions.length) {
    await notifyEmployees({
      businessId: input.businessId,
      employeeIds: mentions,
      skipUserIds: [input.actor.uid],
      title: `${actorName || "משתמש"} תייג אותך במשימה ${loaded.task.title}`,
      body: body.slice(0, 140),
      href: taskHref(input.taskId, true),
      type: "task.mention",
      entityType: "task",
      entityId: input.taskId,
      subject: "WEGO BIZ — הזכירו אותך במשימה",
      channels: { inApp: true, email: true },
      dedupeKey: `TASK_MENTION:${input.taskId}:${ref.id}`,
    });
  }

  const others = taskParticipantIds(loaded.task).filter((id) => !mentions.includes(id));
  await notifyEmployees({
    businessId: input.businessId,
    employeeIds: others,
    skipUserIds: [input.actor.uid],
    title: `הודעה חדשה במשימה ${loaded.task.title}`,
    body: (body || linkTitle || attachments[0]?.name || "").slice(0, 140),
    href: taskHref(input.taskId, true),
    type: "task.comment",
    entityType: "task",
    entityId: input.taskId,
    channels: { inApp: true, email: false },
    dedupeKey: `TASK_COMMENT:${input.taskId}:${ref.id}`,
  });

  if (loaded.task.createdByUserId && loaded.task.createdByUserId !== input.actor.uid) {
    await notifyUsers({
      businessId: input.businessId,
      userIds: [loaded.task.createdByUserId],
      skipUserIds: [input.actor.uid],
      title: `הודעה חדשה במשימה ${loaded.task.title}`,
      body: (body || linkTitle || attachments[0]?.name || "").slice(0, 140),
      href: taskHref(input.taskId, true),
      type: "task.comment",
      entityType: "task",
      entityId: input.taskId,
      channels: { inApp: true, email: false },
      dedupeKey: `TASK_COMMENT:${input.taskId}:${ref.id}`,
    });
  }

  return { ok: true as const, id: ref.id };
}

export async function editTaskComment(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  commentId: string;
  body: string;
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const body = text(input.body);
  if (!body) return { ok: false as const, error: "TASK_FIELDS" as const, status: 400 };
  const db = getAdminDb();
  const ref = db.collection(taskCommentsPath(input.businessId, input.taskId)).doc(input.commentId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  const data = snap.data() ?? {};
  if (data.deletedAt) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  if (String(data.authorUserId ?? "") !== input.actor.uid) {
    return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  }
  const now = new Date();
  await ref.set({ body, editedAt: now, updatedAt: now }, { merge: true });
  return { ok: true as const, id: input.commentId };
}

export async function deleteTaskComment(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  commentId: string;
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const db = getAdminDb();
  const ref = db.collection(taskCommentsPath(input.businessId, input.taskId)).doc(input.commentId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as const, status: 404 };
  const data = snap.data() ?? {};
  const isAuthor = String(data.authorUserId ?? "") === input.actor.uid;
  const isManager = input.actor.isSuperAdmin || input.actor.isOwnerOrManager || actorCan(input.actor, "tasks.edit") || actorCan(input.actor, "tasks.delete");
  if (!isAuthor && !isManager) return { ok: false as const, error: "FORBIDDEN" as const, status: 403 };
  const now = new Date();
  await ref.set({ deletedAt: now, updatedAt: now, body: "" }, { merge: true });
  return { ok: true as const, id: input.commentId };
}

export async function markTaskThreadRead(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  await getAdminDb().doc(taskReadDocPath(input.businessId, input.taskId, input.actor.uid)).set({
    businessId: input.businessId,
    taskId: input.taskId,
    userId: input.actor.uid,
    lastReadAt: new Date(),
  }, { merge: true });
  return { ok: true as const };
}
