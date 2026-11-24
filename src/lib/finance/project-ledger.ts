import { money } from "@/lib/finance/money";
import { paymentStatusFor } from "@/lib/finance/vat";
import type { PaymentRecord } from "@/types/payment";
import type { Project } from "@/types/department";
import type { Task, TaskBillingMode } from "@/types/task";

export type ProjectFinanceSnapshot = {
  basePrice: number;
  extrasTotal: number;
  totalDue: number;
  paid: number;
  balanceDue: number;
  credit: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CREDIT";
  billableTaskIds: string[];
  includedTaskCount: number;
};

/** Legacy priced tasks without billingMode count as billable. */
export function resolveTaskBillingMode(task: Pick<Task, "billingMode" | "priceIncludingVat">): TaskBillingMode {
  if (task.billingMode === "BILLABLE" || task.billingMode === "INCLUDED") return task.billingMode;
  return task.priceIncludingVat !== null ? "BILLABLE" : "INCLUDED";
}

export function isBillableFinanceTask(task: Pick<Task, "billingMode" | "priceIncludingVat">) {
  return resolveTaskBillingMode(task) === "BILLABLE" && task.priceIncludingVat !== null;
}

export function projectBasePriceIncludingVat(project: Pick<Project, "basePriceIncludingVat">) {
  const value = project.basePriceIncludingVat;
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return money(Math.max(0, value));
}

export function projectBasePaidAmount(project: Pick<Project, "basePaidAmount">) {
  return money(Math.max(0, project.basePaidAmount ?? 0));
}

/**
 * Unified project finance truth:
 * due = project base (optional) + billable task prices only.
 * paid = project base paid + billable task paid (each payment allocated once).
 * Included/normal tasks never affect income.
 */
export function computeProjectFinance(
  project: Pick<Project, "basePriceIncludingVat" | "basePaidAmount">,
  tasks: Array<Pick<Task, "id" | "billingMode" | "priceIncludingVat" | "paidAmount">>,
): ProjectFinanceSnapshot {
  const basePrice = projectBasePriceIncludingVat(project);
  const billable = tasks.filter(isBillableFinanceTask);
  const includedTaskCount = tasks.filter((task) => resolveTaskBillingMode(task) === "INCLUDED").length;
  const extrasTotal = money(billable.reduce((sum, task) => sum + (task.priceIncludingVat ?? 0), 0));
  const totalDue = money(basePrice + extrasTotal);
  const paid = money(
    projectBasePaidAmount(project)
    + billable.reduce((sum, task) => sum + money(task.paidAmount ?? 0), 0),
  );
  const balanceDue = money(Math.max(0, totalDue - paid));
  const credit = money(Math.max(0, paid - totalDue));
  let paymentStatus: ProjectFinanceSnapshot["paymentStatus"];
  if (credit > 0) paymentStatus = "CREDIT";
  else if (totalDue <= 0 && paid <= 0) paymentStatus = "UNPAID";
  else paymentStatus = paymentStatusFor(paid, totalDue) ?? "UNPAID";

  return {
    basePrice,
    extrasTotal,
    totalDue,
    paid,
    balanceDue,
    credit,
    paymentStatus,
    billableTaskIds: billable.map((task) => task.id),
    includedTaskCount,
  };
}

export function paymentTouchesProject(payment: PaymentRecord, projectId: string, projectTaskIds: Set<string>) {
  if (payment.projectId === projectId) return true;
  return payment.allocations.some((row) => {
    if (row.target === "PROJECT_BASE" && row.projectId === projectId) return true;
    if (row.taskId && projectTaskIds.has(row.taskId)) return true;
    return false;
  });
}

/** Sum recorded payment amounts for a project without double-counting a payment id. */
export function sumProjectRecordedPayments(
  payments: PaymentRecord[],
  projectId: string,
  projectTaskIds: Set<string>,
) {
  const seen = new Set<string>();
  let total = 0;
  for (const payment of payments) {
    if (payment.status !== "RECORDED") continue;
    if (seen.has(payment.id)) continue;
    if (!paymentTouchesProject(payment, projectId, projectTaskIds)) continue;
    seen.add(payment.id);
    total = money(total + payment.amount);
  }
  return total;
}
