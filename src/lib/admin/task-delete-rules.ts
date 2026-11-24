import type { Permission } from "@/types/permissions";
import type { BusinessRole } from "@/types/roles";
import type { Task } from "@/types/task";

export type TaskDeleteBlocker =
  | "PAYMENTS"
  | "WORK_HOURS"
  | "DOCUMENTS";

export type TaskDeleteBlockError =
  | "TASK_HAS_PAYMENTS"
  | "TASK_HAS_WORK_HOURS"
  | "TASK_HAS_DOCUMENTS";

export function isTaskSoftDeleted(task: Pick<Task, "deletedAt"> | { deletedAt?: unknown } | null | undefined) {
  return Boolean(task && task.deletedAt != null);
}

export function canDeleteTasks(actor: {
  permissions: readonly Permission[];
  isSuperAdmin?: boolean;
}) {
  return Boolean(actor.isSuperAdmin || actor.permissions.includes("tasks.delete"));
}

export function canRestoreTasks(actor: {
  role: BusinessRole | null;
  isSuperAdmin?: boolean;
}) {
  return Boolean(actor.isSuperAdmin || actor.role === "BUSINESS_OWNER");
}

/**
 * Only actual received money / payment links block soft-delete.
 * A billable task with a price but no payments may be soft-deleted;
 * soft-delete excludes it from project totals until restored.
 */
export function taskHasBlockingPayments(task: Pick<
  Task,
  "paidAmount" | "paymentIds" | "paymentStatus"
>) {
  if ((task.paidAmount ?? 0) > 0) return true;
  if ((task.paymentIds?.length ?? 0) > 0) return true;
  if (task.paymentStatus && task.paymentStatus !== "UNPAID") return true;
  return false;
}

/** @deprecated use taskHasBlockingPayments — priced-only tasks are no longer blocked. */
export function taskHasProtectedFinance(task: Pick<
  Task,
  "paidAmount" | "paymentIds" | "billingMode" | "priceIncludingVat" | "paymentStatus"
>) {
  return taskHasBlockingPayments(task);
}

export function localFinanceBlockers(task: Parameters<typeof taskHasBlockingPayments>[0]): TaskDeleteBlocker[] {
  return taskHasBlockingPayments(task) ? ["PAYMENTS"] : [];
}

const BLOCKER_PRIORITY: TaskDeleteBlocker[] = ["PAYMENTS", "WORK_HOURS", "DOCUMENTS"];

export function primaryDeleteBlocker(blockers: TaskDeleteBlocker[]): TaskDeleteBlocker | null {
  for (const key of BLOCKER_PRIORITY) {
    if (blockers.includes(key)) return key;
  }
  return blockers[0] ?? null;
}

export function deleteBlockerToError(blocker: TaskDeleteBlocker): TaskDeleteBlockError {
  if (blocker === "WORK_HOURS") return "TASK_HAS_WORK_HOURS";
  if (blocker === "DOCUMENTS") return "TASK_HAS_DOCUMENTS";
  return "TASK_HAS_PAYMENTS";
}
