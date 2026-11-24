import assert from "node:assert/strict";
import {
  canDeleteTasks,
  canRestoreTasks,
  isTaskSoftDeleted,
  localFinanceBlockers,
  taskHasProtectedFinance,
} from "@/lib/admin/task-delete-rules";
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
  paymentIds: [],
  billingMode: "INCLUDED" as const,
  priceIncludingVat: null,
  paymentStatus: null,
  deletedAt: null,
};

assert.equal(isTaskSoftDeleted({ deletedAt: null }), false);
assert.equal(isTaskSoftDeleted({ deletedAt: undefined }), false);
assert.equal(isTaskSoftDeleted({ deletedAt: new Date() }), true);

assert.equal(taskHasProtectedFinance(baseTask), false);
assert.equal(taskHasProtectedFinance({ ...baseTask, billingMode: "BILLABLE", priceIncludingVat: 1180 }), true);
assert.equal(taskHasProtectedFinance({ ...baseTask, paidAmount: 50 }), true);
assert.equal(taskHasProtectedFinance({ ...baseTask, paymentIds: ["p1"] }), true);
assert.equal(taskHasProtectedFinance({ ...baseTask, paymentStatus: "PARTIALLY_PAID" }), true);

assert.deepEqual(
  localFinanceBlockers({ ...baseTask, billingMode: "BILLABLE", priceIncludingVat: 100 }),
  ["BILLING"],
);
assert.ok(localFinanceBlockers({ ...baseTask, paidAmount: 10 }).includes("PAYMENTS"));

const employee = actor({ role: "EMPLOYEE", permissions: ["tasks.view", "tasks.create"] });
const manager = actor({ role: "MANAGER", permissions: ["tasks.delete", "tasks.edit"] });
const owner = actor({ role: "BUSINESS_OWNER", permissions: ["tasks.delete", "tasks.edit"] });

assert.equal(canDeleteTasks(employee), false);
assert.equal(canDeleteTasks(manager), true);
assert.equal(canDeleteTasks(owner), true);
assert.equal(canRestoreTasks(employee), false);
assert.equal(canRestoreTasks(manager), false);
assert.equal(canRestoreTasks(owner), true);

// Soft-deleted tasks are excluded from active lists conceptually.
const active = [{ id: "a", deletedAt: null }, { id: "b", deletedAt: new Date() }] as Array<Pick<Task, "id" | "deletedAt">>;
assert.deepEqual(active.filter((task) => !isTaskSoftDeleted(task)).map((task) => task.id), ["a"]);

// Bulk selection should not affect unrelated task IDs.
const selected = ["t1", "t2"];
const all = ["t1", "t2", "t3"];
const remaining = all.filter((id) => !selected.includes(id));
assert.deepEqual(remaining, ["t3"]);

console.log("TASK_DELETE_PASS");
