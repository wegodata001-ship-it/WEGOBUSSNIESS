import assert from "node:assert/strict";
import { permissionsForRole, resolvePermissions } from "@/lib/permissions/engine";
import type { Membership } from "@/types/membership";

function member(role: Membership["role"], extras: Membership["permissions"] = []): Membership {
  return {
    userId: "u1",
    businessId: "b1",
    employeeId: "e1",
    role,
    permissions: extras,
    email: "a@b.c",
    displayName: "Test",
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };
}

assert.ok(permissionsForRole("EMPLOYEE").includes("tasks.view"));
assert.ok(!permissionsForRole("EMPLOYEE").includes("settings.manage"));
assert.ok(!permissionsForRole("EMPLOYEE").includes("employees.manage"));
assert.ok(!permissionsForRole("EMPLOYEE").includes("finance.view"));

assert.ok(permissionsForRole("MANAGER").includes("employees.manage"));
assert.ok(permissionsForRole("MANAGER").includes("departments.manage"));
assert.ok(!permissionsForRole("MANAGER").includes("settings.manage"));

assert.ok(permissionsForRole("BUSINESS_OWNER").includes("settings.manage"));
assert.ok(permissionsForRole("BUSINESS_OWNER").includes("employees.manage"));

const elevated = resolvePermissions(member("EMPLOYEE", ["settings.manage", "employees.manage"]));
assert.ok(!elevated.includes("settings.manage"));
assert.ok(!elevated.includes("employees.manage"));
assert.deepEqual(elevated, permissionsForRole("EMPLOYEE"));

console.log("PERMISSIONS_ROLE_SOURCE_PASS");
