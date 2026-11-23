import assert from "node:assert/strict";
import {
  canListBusinessProjects,
  canViewAllBusinessProjects,
  filterProjectsForActor,
  projectIdsForAssignedWork,
} from "@/lib/permissions/project-access";
import { permissionsForRole } from "@/lib/permissions/engine";

const employeePerms = permissionsForRole("EMPLOYEE");
const managerPerms = permissionsForRole("MANAGER");
const ownerPerms = permissionsForRole("BUSINESS_OWNER");

assert.equal(canListBusinessProjects({ permissions: employeePerms }), true);
assert.equal(canListBusinessProjects({ permissions: managerPerms }), true);
assert.equal(canListBusinessProjects({ permissions: ownerPerms }), true);
assert.equal(canListBusinessProjects({ isSuperAdmin: true, permissions: [] }), true);
assert.equal(canListBusinessProjects({ permissions: [] }), false);
assert.ok(!employeePerms.includes("projects.view"));

const employee = {
  uid: "u-emp",
  employeeId: "e1",
  isOwnerOrManager: false,
  permissions: employeePerms,
};

const manager = {
  uid: "u-mgr",
  employeeId: "e-mgr",
  isOwnerOrManager: true,
  permissions: managerPerms,
};

assert.equal(canViewAllBusinessProjects(employee), false);
assert.equal(canViewAllBusinessProjects(manager), true);
assert.equal(canViewAllBusinessProjects({
  uid: "u-owner",
  employeeId: "e-owner",
  isOwnerOrManager: true,
  permissions: ownerPerms,
}), true);

const projects = [
  { id: "p1" },
  { id: "p2" },
  { id: "p3" },
];

const tasks = [
  {
    projectId: "p1",
    status: "TODO" as const,
    createdByUserId: "other",
    assigneeId: "e1",
    collaboratorIds: [] as string[],
  },
  {
    projectId: "p2",
    status: "IN_PROGRESS" as const,
    createdByUserId: "other",
    assigneeId: "e9",
    collaboratorIds: [] as string[],
  },
  {
    projectId: "p3",
    status: "PENDING_APPROVAL" as const,
    createdByUserId: "u-emp",
    assigneeId: null,
    collaboratorIds: [] as string[],
  },
];

const allowed = projectIdsForAssignedWork(employee, tasks);
assert.ok(allowed.has("p1"));
assert.ok(allowed.has("p3"));
assert.ok(!allowed.has("p2"));

const filtered = filterProjectsForActor(employee, projects, tasks);
assert.deepEqual(filtered.map((item) => item.id).sort(), ["p1", "p3"]);

const allForManager = filterProjectsForActor(manager, projects, tasks);
assert.equal(allForManager.length, 3);

console.log("PROJECT_ACCESS_PASS");
