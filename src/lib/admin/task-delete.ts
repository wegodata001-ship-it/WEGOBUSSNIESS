import { writeActivity } from "@/lib/admin/activity";
import { writeTaskActivity } from "@/lib/admin/task-activity";
import { syncProjectProgressFromTasks } from "@/lib/admin/project-progress-sync";
import {
  canDeleteTasks,
  canRestoreTasks,
  deleteBlockerToError,
  isTaskSoftDeleted,
  localFinanceBlockers,
  primaryDeleteBlocker,
  type TaskDeleteBlocker,
  type TaskDeleteBlockError,
} from "@/lib/admin/task-delete-rules";
import type { ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { toTask } from "@/lib/firebase/converters";
import {
  businessDocsPath,
  documentsPath,
  paymentsPath,
  taskDocPath,
  workSessionsPath,
} from "@/lib/firebase/paths";
import type { Task } from "@/types/task";

export type { TaskDeleteBlocker, TaskDeleteBlockError };
export {
  canDeleteTasks,
  canRestoreTasks,
  deleteBlockerToError,
  isTaskSoftDeleted,
  localFinanceBlockers,
  primaryDeleteBlocker,
  taskHasBlockingPayments,
  taskHasProtectedFinance,
} from "@/lib/admin/task-delete-rules";

export type TaskDeleteError =
  | "FORBIDDEN"
  | "MISSING_ID"
  | "NOT_FOUND"
  | "ALREADY_DELETED"
  | "NOT_DELETED"
  | TaskDeleteBlockError;

export type TaskDeleteResult =
  | { ok: true; id: string }
  | { ok: false; error: TaskDeleteError; status: number; blockers?: TaskDeleteBlocker[] };

export type TaskBulkDeleteResult =
  | { ok: true; ids: string[]; skipped: Array<{ id: string; error: TaskDeleteError; blockers?: TaskDeleteBlocker[] }> }
  | { ok: false; error: TaskDeleteError; status: number; blockers?: TaskDeleteBlocker[] };

export async function collectTaskDeleteBlockers(input: {
  businessId: string;
  task: Task;
}): Promise<TaskDeleteBlocker[]> {
  const blockers = [...localFinanceBlockers(input.task)];

  const db = getAdminDb();
  const [paymentsSnap, sessionSnap, legacyDocSnap, businessDocSnap] = await Promise.all([
    db.collection(paymentsPath(input.businessId)).limit(300).get(),
    db.collection(workSessionsPath(input.businessId)).where("taskId", "==", input.task.id).limit(1).get(),
    db.collection(documentsPath(input.businessId)).where("taskId", "==", input.task.id).limit(1).get(),
    db.collection(businessDocsPath(input.businessId)).where("taskId", "==", input.task.id).limit(1).get(),
  ]);

  const hasPaymentLink = paymentsSnap.docs.some((docSnap) => {
    const data = docSnap.data();
    if (data.status === "VOIDED") return false;
    const allocations = Array.isArray(data.allocations) ? data.allocations : [];
    return allocations.some((row: { taskId?: unknown }) => row?.taskId === input.task.id);
  });
  if (hasPaymentLink && !blockers.includes("PAYMENTS")) blockers.push("PAYMENTS");
  if (!sessionSnap.empty) blockers.push("WORK_HOURS");
  if (!legacyDocSnap.empty || !businessDocSnap.empty) blockers.push("DOCUMENTS");
  return blockers;
}

async function loadTask(businessId: string, taskId: string) {
  const snap = await getAdminDb().doc(taskDocPath(businessId, taskId)).get();
  if (!snap.exists) return null;
  return toTask(snap.id, snap.data()!);
}

export async function softDeleteTask(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
}): Promise<TaskDeleteResult> {
  if (!canDeleteTasks(input.actor)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  const taskId = input.taskId.trim();
  if (!taskId) return { ok: false, error: "MISSING_ID", status: 400 };

  const task = await loadTask(input.businessId, taskId);
  if (!task) return { ok: false, error: "NOT_FOUND", status: 404 };
  if (isTaskSoftDeleted(task)) return { ok: false, error: "ALREADY_DELETED", status: 409 };

  const blockers = await collectTaskDeleteBlockers({ businessId: input.businessId, task });
  if (blockers.length) {
    const primary = primaryDeleteBlocker(blockers)!;
    return {
      ok: false,
      error: deleteBlockerToError(primary),
      status: 409,
      blockers: [primary],
    };
  }

  const now = new Date();
  const ref = getAdminDb().doc(taskDocPath(input.businessId, taskId));
  await ref.set({
    deletedAt: now,
    deletedByUserId: input.actor.uid,
    updatedAt: now,
  }, { merge: true });

  await writeTaskActivity({
    businessId: input.businessId,
    taskId,
    actorUserId: input.actor.uid,
    actorEmployeeId: input.actor.employeeId,
    type: "updated",
    message: "המשימה נמחקה (מחיקה רכה)",
  });
  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "deleteTask",
    entityType: "task",
    entityId: taskId,
    message: "משימה נמחקה",
  });
  await syncProjectProgressFromTasks(input.businessId, task.projectId);
  return { ok: true, id: taskId };
}

export async function softDeleteTasks(input: {
  actor: ServerActor;
  businessId: string;
  taskIds: string[];
}): Promise<TaskBulkDeleteResult> {
  if (!canDeleteTasks(input.actor)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  const uniqueIds = [...new Set(input.taskIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length) return { ok: false, error: "MISSING_ID", status: 400 };

  const deleted: string[] = [];
  const skipped: Array<{ id: string; error: TaskDeleteError; blockers?: TaskDeleteBlocker[] }> = [];

  for (const taskId of uniqueIds) {
    const result = await softDeleteTask({
      actor: input.actor,
      businessId: input.businessId,
      taskId,
    });
    if (result.ok) deleted.push(result.id);
    else skipped.push({ id: taskId, error: result.error, blockers: result.blockers });
  }

  if (!deleted.length && skipped.length) {
    const first = skipped[0]!;
    return {
      ok: false,
      error: first.error,
      status: first.error === "FORBIDDEN" ? 403 : 409,
      blockers: first.blockers,
    };
  }

  return { ok: true, ids: deleted, skipped };
}

export async function restoreTask(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
}): Promise<TaskDeleteResult> {
  if (!canRestoreTasks(input.actor)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  const taskId = input.taskId.trim();
  if (!taskId) return { ok: false, error: "MISSING_ID", status: 400 };

  const task = await loadTask(input.businessId, taskId);
  if (!task) return { ok: false, error: "NOT_FOUND", status: 404 };
  if (!isTaskSoftDeleted(task)) return { ok: false, error: "NOT_DELETED", status: 409 };

  const now = new Date();
  await getAdminDb().doc(taskDocPath(input.businessId, taskId)).set({
    deletedAt: null,
    deletedByUserId: null,
    updatedAt: now,
  }, { merge: true });

  await writeTaskActivity({
    businessId: input.businessId,
    taskId,
    actorUserId: input.actor.uid,
    actorEmployeeId: input.actor.employeeId,
    type: "updated",
    message: "המשימה שוחזרה ממחיקה",
  });
  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "restoreTask",
    entityType: "task",
    entityId: taskId,
    message: "משימה שוחזרה",
  });
  await syncProjectProgressFromTasks(input.businessId, task.projectId);
  return { ok: true, id: taskId };
}
