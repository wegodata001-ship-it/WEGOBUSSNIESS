import assert from "node:assert/strict";
import { canListBusinessProjects } from "@/lib/permissions/project-access";
import { permissionsForRole } from "@/lib/permissions/engine";

assert.equal(canListBusinessProjects({ permissions: permissionsForRole("EMPLOYEE") }), true);
assert.equal(canListBusinessProjects({ permissions: permissionsForRole("MANAGER") }), true);
assert.equal(canListBusinessProjects({ permissions: permissionsForRole("BUSINESS_OWNER") }), true);
assert.equal(canListBusinessProjects({ isSuperAdmin: true, permissions: [] }), true);
assert.equal(canListBusinessProjects({ permissions: [] }), false);
assert.ok(!permissionsForRole("EMPLOYEE").includes("projects.view"));

console.log("PROJECT_ACCESS_PASS");
