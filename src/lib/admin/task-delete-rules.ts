import type { Permission } from "@/types/permissions";
import type { BusinessRole } from "@/types/roles";
import type { Task } from "@/types/task";

export type TaskDeleteBlocker =
  | "PAYMENTS"
  | "BILLING"
  | "WORK_HOURS"
  | "DOCUMENTS";

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

/** Local finance / billing signals that must stay intact for accounting. */
export function taskHasProtectedFinance(task: Pick<
  Task,
  "paidAmount" | "paymentIds" | "billingMode" | "priceIncludingVat" | "paymentStatus"
>) {
  if ((task.paidAmount ?? 0) > 0) return true;
  if ((task.paymentIds?.length ?? 0) > 0) return true;
  if (task.paymentStatus && task.paymentStatus !== "UNPAID") return true;
  if (task.billingMode === "BILLABLE" && task.priceIncludingVat != null) return true;
  if (task.priceIncludingVat != null && (task.paidAmount ?? 0) > 0) return true;
  return false;
}

export function localFinanceBlockers(task: Parameters<typeof taskHasProtectedFinance>[0]): TaskDeleteBlocker[] {
  if (!taskHasProtectedFinance(task)) return [];
  const blockers: TaskDeleteBlocker[] = [];
  if (task.billingMode === "BILLABLE" || task.priceIncludingVat != null) blockers.push("BILLING");
  if ((task.paidAmount ?? 0) > 0 || (task.paymentIds?.length ?? 0) > 0 || (task.paymentStatus && task.paymentStatus !== "UNPAID")) {
    blockers.push("PAYMENTS");
  }
  if (!blockers.length) blockers.push("BILLING");
  return blockers;
}
