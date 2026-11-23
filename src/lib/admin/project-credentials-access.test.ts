import assert from "node:assert/strict";
import { canManageProjectCredentials } from "@/lib/admin/project-credentials";
import type { ServerActor } from "@/lib/auth/server-actor";

function actor(partial: Partial<ServerActor>): ServerActor {
  return {
    uid: "u1",
    businessId: "b1",
    employeeId: "e1",
    role: null,
    permissions: [],
    isOwnerOrManager: false,
    isSuperAdmin: false,
    ...partial,
  };
}

assert.equal(canManageProjectCredentials(actor({ role: "BUSINESS_OWNER", isOwnerOrManager: true })), true);
assert.equal(canManageProjectCredentials(actor({ isSuperAdmin: true })), true);
assert.equal(canManageProjectCredentials(actor({ role: "MANAGER", isOwnerOrManager: true })), false);
assert.equal(canManageProjectCredentials(actor({ role: "EMPLOYEE" })), false);
assert.equal(canManageProjectCredentials(actor({ role: null })), false);

console.log("project-credentials-access.test.ts: OK");
