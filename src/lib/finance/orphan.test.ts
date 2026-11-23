import assert from "node:assert/strict";
import { activeMovements, activePayments, isOrphanMovement, isOrphanPayment } from "@/lib/finance/orphan";
import type { MoneyMovement } from "@/types/movement";
import type { PaymentRecord } from "@/types/payment";

function movement(partial: Partial<MoneyMovement>): MoneyMovement {
  return {
    id: "m1",
    businessId: "b1",
    type: "INCOME",
    amount: 100,
    date: "2026-10-01",
    clientId: null,
    clientName: "",
    projectId: null,
    taskIds: [],
    paymentId: null,
    paymentMethod: null,
    description: "",
    note: "",
    status: "RECORDED",
    createdByUserId: "u1",
    createdByEmployeeId: null,
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

const live = {
  projectIds: new Set(["p-live"]),
  taskIds: new Set(["t-live"]),
};

assert.equal(isOrphanMovement(movement({ projectId: "p-gone" }), live), true);
assert.equal(isOrphanMovement(movement({ taskIds: ["t-gone"] }), live), true);
assert.equal(isOrphanMovement(movement({ projectId: "p-live" }), live), false);
assert.equal(isOrphanMovement(movement({ taskIds: ["t-live"] }), live), false);
assert.equal(isOrphanMovement(movement({ projectId: null, taskIds: [] }), live), false);

assert.equal(activeMovements([
  movement({ id: "keep", projectId: "p-live" }),
  movement({ id: "drop", projectId: "p-gone" }),
], live).map((item) => item.id).join(","), "keep");

const payment = (taskId: string): PaymentRecord => ({
  id: "pay1",
  businessId: "b1",
  amount: 50,
  paymentDate: "2026-10-01",
  paymentMethod: "CASH",
  reference: "",
  notes: "",
  status: "RECORDED",
  allocations: [{ paymentId: "pay1", taskId, amount: 50 }],
  createdByUserId: "u1",
  createdByEmployeeId: null,
  createdAt: null,
  cancelledByUserId: null,
  cancelledAt: null,
  cancelReason: null,
});

assert.equal(isOrphanPayment(payment("t-gone"), live.taskIds), true);
assert.equal(isOrphanPayment(payment("t-live"), live.taskIds), false);
assert.equal(activePayments([payment("t-gone"), payment("t-live")], live.taskIds).length, 1);

console.log("orphan.test.ts: OK");
