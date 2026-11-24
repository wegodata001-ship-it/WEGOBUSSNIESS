import assert from "node:assert/strict";
import { canChangeWorkStatus, canSeeTaskDoc } from "@/lib/admin/task-access";
import { permissionsForRole } from "@/lib/permissions/engine";

const employeeA = {
  uid: "u-a",
  businessId: "b1",
  employeeId: "e-a",
  role: "EMPLOYEE" as const,
  permissions: permissionsForRole("EMPLOYEE"),
  isOwnerOrManager: false,
  isSuperAdmin: false,
};

const employeeB = {
  ...employeeA,
  uid: "u-b",
  employeeId: "e-b",
};

const manager = {
  uid: "u-m",
  businessId: "b1",
  employeeId: "e-m",
  role: "MANAGER" as const,
  permissions: permissionsForRole("MANAGER"),
  isOwnerOrManager: true,
  isSuperAdmin: false,
};

const mine = {
  status: "TODO" as const,
  createdByUserId: "u-other",
  assigneeId: "e-a",
  collaboratorIds: [] as string[],
};

const theirs = {
  status: "TODO" as const,
  createdByUserId: "u-other",
  assigneeId: "e-b",
  collaboratorIds: [] as string[],
};

const pendingMine = {
  status: "PENDING_APPROVAL" as const,
  createdByUserId: "u-a",
  assigneeId: null,
  collaboratorIds: [] as string[],
};

assert.equal(canSeeTaskDoc(employeeA, mine), true);
assert.equal(canSeeTaskDoc(employeeA, theirs), false);
assert.equal(canSeeTaskDoc(employeeB, mine), false);
assert.equal(canSeeTaskDoc(manager, theirs), true);
assert.equal(canSeeTaskDoc(employeeA, pendingMine), true);
assert.equal(canSeeTaskDoc(employeeB, pendingMine), false);

assert.equal(canChangeWorkStatus(employeeA, mine), true);
assert.equal(canChangeWorkStatus(employeeA, theirs), false);
assert.equal(canChangeWorkStatus(manager, theirs), true);

// Guessing another employee's id must not grant access.
assert.equal(canSeeTaskDoc({ ...employeeA, employeeId: "e-b" }, mine), false);

console.log("TASK_ACCESS_PASS");
