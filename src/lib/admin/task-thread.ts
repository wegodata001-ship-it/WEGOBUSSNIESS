import { notifyEmployees, notifyUsers, taskHref } from "@/lib/admin/notify";
import { canAccessTaskChat, taskParticipantIds } from "@/lib/admin/task-access";
import { writeTaskActivity } from "@/lib/admin/task-activity";
import { type ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { toTask, toTaskActivity, toTaskComment } from "@/lib/firebase/converters";
import { toTimestamp } from "@/lib/dates/timestamp";
import { employeeDocPath, taskActivityPath, taskCommentsPath, taskDocPath } from "@/lib/firebase/paths";

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
  return { ok: true as const, comments, activity };
}

export async function addTaskComment(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  body: string;
  mentions?: string[];
}) {
  const loaded = await loadTaskForActor(input.actor, input.businessId, input.taskId);
  if ("error" in loaded) return { ok: false as const, error: loaded.error, status: loaded.error === "NOT_FOUND" ? 404 : 403 };
  const body = text(input.body);
  if (!body) return { ok: false as const, error: "TASK_FIELDS" as const, status: 400 };

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
    attachments: [],
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
    });
  }

  const others = taskParticipantIds(loaded.task).filter((id) => !mentions.includes(id));
  await notifyEmployees({
    businessId: input.businessId,
    employeeIds: others,
    skipUserIds: [input.actor.uid],
    title: `הודעה חדשה במשימה ${loaded.task.title}`,
    body: body.slice(0, 140),
    href: taskHref(input.taskId, true),
    type: "task.comment",
    entityType: "task",
    entityId: input.taskId,
    channels: { inApp: true, email: false },
  });

  if (loaded.task.createdByUserId && loaded.task.createdByUserId !== input.actor.uid) {
    await notifyUsers({
      businessId: input.businessId,
      userIds: [loaded.task.createdByUserId],
      skipUserIds: [input.actor.uid],
      title: `הודעה חדשה במשימה ${loaded.task.title}`,
      body: body.slice(0, 140),
      href: taskHref(input.taskId, true),
      type: "task.comment",
      entityType: "task",
      entityId: input.taskId,
      channels: { inApp: true, email: false },
    });
  }

  return { ok: true as const, id: ref.id };
}
