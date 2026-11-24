import assert from "node:assert/strict";
import { permissionsForRole } from "@/lib/permissions/engine";
import {
  canViewEmployeeDirectory,
  filterEmployeesForActor,
  filterSessionsForActor,
} from "@/lib/permissions/employee-directory-access";
import type { Employee } from "@/types/employee";

function emp(id: string, name: string): Employee {
  return {
    id,
    businessId: "b1",
    userId: null,
    uid: null,
    firstName: name,
    lastName: "",
    displayName: name,
    name,
    email: null,
    phone: null,
    departmentId: null,
    jobTitle: null,
    role: "EMPLOYEE",
    status: "ACTIVE",
    active: true,
    startDate: null,
    createdAt: null,
    updatedAt: null,
  };
}

const siham = {
  uid: "auth-siham",
  businessId: "b1",
  employeeId: "emp-siham",
  role: "EMPLOYEE" as const,
  permissions: permissionsForRole("EMPLOYEE"),
  isOwnerOrManager: false,
  isSuperAdmin: false,
};

const owner = {
  uid: "auth-owner",
  businessId: "b1",
  employeeId: "emp-owner",
  role: "BUSINESS_OWNER" as const,
  permissions: permissionsForRole("BUSINESS_OWNER"),
  isOwnerOrManager: true,
  isSuperAdmin: false,
};

const unlinked = {
  ...siham,
  employeeId: null,
};

const employees = [
  emp("emp-siham", "סיהאם דבור"),
  emp("emp-owner", "WEGO Owner"),
  emp("emp-other", "Other"),
];

assert.equal(canViewEmployeeDirectory(siham), false);
assert.equal(canViewEmployeeDirectory(owner), true);

// EMPLOYEE with tasks.view must NOT get full roster — only self when no shared tasks.
assert.deepEqual(
  filterEmployeesForActor(siham, employees, []).map((item) => item.id),
  ["emp-siham"],
);

// Collaborator on a visible task can see that person's name (chip), still not WEGO Owner unless on task.
assert.deepEqual(
  filterEmployeesForActor(siham, employees, [
    {
      status: "TODO",
      createdByUserId: "x",
      assigneeId: "emp-siham",
      collaboratorIds: ["emp-other"],
    },
  ]).map((item) => item.id).sort(),
  ["emp-other", "emp-siham"],
);

assert.deepEqual(
  filterEmployeesForActor(owner, employees, []).map((item) => item.id).sort(),
  ["emp-other", "emp-owner", "emp-siham"],
);

const sessions = [
  { id: "s1", employeeId: "emp-siham" },
  { id: "s2", employeeId: "emp-owner" },
];

assert.deepEqual(
  filterSessionsForActor(siham, sessions, false).map((item) => item.id),
  ["s1"],
);
assert.deepEqual(filterSessionsForActor(unlinked, sessions, false), []);
assert.deepEqual(
  filterSessionsForActor(owner, sessions, true).map((item) => item.id),
  ["s1", "s2"],
);

console.log("EMPLOYEE_DIRECTORY_ACCESS_PASS");
