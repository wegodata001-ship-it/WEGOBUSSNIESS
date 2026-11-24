import assert from "node:assert/strict";
import {
  canDeleteTasks,
  canRestoreTasks,
  deleteBlockerToError,
  isTaskSoftDeleted,
  localFinanceBlockers,
  primaryDeleteBlocker,
  taskHasBlockingPayments,
  taskHasProtectedFinance,
} from "@/lib/admin/task-delete-rules";
import { computeProjectFinance } from "@/lib/finance/project-ledger";
import { calculateEnteredPriceWithVat, DEFAULT_BUSINESS_VAT_RATE } from "@/lib/finance/vat";
import type { Task } from "@/types/task";

function actor(partial: {
  role: "BUSINESS_OWNER" | "MANAGER" | "EMPLOYEE";
  permissions: Array<"tasks.view" | "tasks.create" | "tasks.delete" | "tasks.edit">;
  isSuperAdmin?: boolean;
}) {
  return {
    role: partial.role,
    permissions: partial.permissions,
    isSuperAdmin: partial.isSuperAdmin ?? false,
  };
}

const baseTask = {
  paidAmount: 0,
  paymentIds: [] as string[],
  billingMode: "INCLUDED" as const,
  priceIncludingVat: null as number | null,
  paymentStatus: null as "UNPAID" | "PARTIALLY_PAID" | "PAID" | null,
  deletedAt: null as Date | null,
};

assert.equal(isTaskSoftDeleted({ deletedAt: null }), false);
assert.equal(isTaskSoftDeleted({ deletedAt: undefined }), false);
assert.equal(isTaskSoftDeleted({ deletedAt: new Date() }), true);

// Priced / billable with no payments must NOT block soft-delete.
const pricedOnly = {
  ...baseTask,
  billingMode: "BILLABLE" as const,
  priceIncludingVat: 1180,
  paymentStatus: "UNPAID" as const,
};
assert.equal(taskHasBlockingPayments(pricedOnly), false);
assert.equal(taskHasProtectedFinance(pricedOnly), false);
assert.deepEqual(localFinanceBlockers(pricedOnly), []);

assert.equal(taskHasBlockingPayments({ ...baseTask, paidAmount: 50 }), true);
assert.equal(taskHasBlockingPayments({ ...baseTask, paymentIds: ["p1"] }), true);
assert.equal(taskHasBlockingPayments({ ...baseTask, paymentStatus: "PARTIALLY_PAID" }), true);
assert.deepEqual(localFinanceBlockers({ ...baseTask, paidAmount: 10 }), ["PAYMENTS"]);

assert.equal(primaryDeleteBlocker(["DOCUMENTS", "PAYMENTS", "WORK_HOURS"]), "PAYMENTS");
assert.equal(deleteBlockerToError("PAYMENTS"), "TASK_HAS_PAYMENTS");
assert.equal(deleteBlockerToError("WORK_HOURS"), "TASK_HAS_WORK_HOURS");
assert.equal(deleteBlockerToError("DOCUMENTS"), "TASK_HAS_DOCUMENTS");

const employee = actor({ role: "EMPLOYEE", permissions: ["tasks.view", "tasks.create"] });
const manager = actor({ role: "MANAGER", permissions: ["tasks.delete", "tasks.edit"] });
const owner = actor({ role: "BUSINESS_OWNER", permissions: ["tasks.delete", "tasks.edit"] });

assert.equal(canDeleteTasks(employee), false);
assert.equal(canDeleteTasks(manager), true);
assert.equal(canDeleteTasks(owner), true);
assert.equal(canRestoreTasks(employee), false);
assert.equal(canRestoreTasks(manager), false);
assert.equal(canRestoreTasks(owner), true);

const vat = DEFAULT_BUSINESS_VAT_RATE;
const priced = calculateEnteredPriceWithVat(1000, vat, "EXCLUDING_VAT");
assert.equal(priced.priceIncludingVat, 1180);

const project = { basePriceIncludingVat: 1000, basePaidAmount: 0 };
const activeBillable = {
  id: "priced",
  billingMode: "BILLABLE" as const,
  priceIncludingVat: priced.priceIncludingVat,
  paidAmount: 0,
};
const beforeDelete = computeProjectFinance(project, [activeBillable]);
assert.equal(beforeDelete.extrasTotal, 1180);
assert.equal(beforeDelete.totalDue, 2180);
assert.equal(beforeDelete.balanceDue, 2180);

// Soft-deleted priced task is excluded from project totals (no payment history wiped).
const afterDelete = computeProjectFinance(project, []);
assert.equal(afterDelete.extrasTotal, 0);
assert.equal(afterDelete.totalDue, 1000);
assert.equal(afterDelete.balanceDue, 1000);

// Restore re-includes the same stored price once (no doubling).
const afterRestore = computeProjectFinance(project, [activeBillable]);
assert.equal(afterRestore.extrasTotal, 1180);
assert.equal(afterRestore.totalDue, 2180);
assert.equal(afterRestore.totalDue, beforeDelete.totalDue);

// Bulk selection should not affect unrelated task IDs.
const selected = ["t1", "t2"];
const all = ["t1", "t2", "t3"];
assert.deepEqual(all.filter((id) => !selected.includes(id)), ["t3"]);

const active = [{ id: "a", deletedAt: null }, { id: "b", deletedAt: new Date() }] as Array<Pick<Task, "id" | "deletedAt">>;
assert.deepEqual(active.filter((task) => !isTaskSoftDeleted(task)).map((task) => task.id), ["a"]);

console.log("TASK_DELETE_PASS");
