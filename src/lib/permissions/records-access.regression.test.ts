import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canSeeMeeting, filterMeetingsForActor } from "@/lib/permissions/meeting-access";
import {
  canListBusinessProjects,
  canViewAllBusinessProjects,
  filterProjectsForActor,
} from "@/lib/permissions/project-access";
import { canAccessBusinessMembership } from "@/lib/auth/business-access";
import { permissionsForRole } from "@/lib/permissions/engine";

const employee = {
  uid: "u-emp",
  employeeId: "e1",
  isOwnerOrManager: false,
  permissions: permissionsForRole("EMPLOYEE"),
};

const outsider = {
  uid: "u-out",
  employeeId: "e-out",
  isOwnerOrManager: false,
  permissions: permissionsForRole("EMPLOYEE"),
};

const noMeetingPerm = {
  uid: "u-none",
  employeeId: "e-none",
  isOwnerOrManager: false,
  permissions: [] as const,
};

const manager = {
  uid: "u-mgr",
  employeeId: "e-mgr",
  isOwnerOrManager: true,
  permissions: permissionsForRole("MANAGER"),
};

const owner = {
  uid: "u-owner",
  employeeId: "e-owner",
  isOwnerOrManager: true,
  permissions: permissionsForRole("BUSINESS_OWNER"),
};

const meetings = [
  {
    id: "m-assigned",
    participantIds: ["e1"],
    participantEmployeeIds: ["e1"],
    createdByUserId: "u-mgr",
    createdBy: "u-mgr",
    createdByEmployeeId: "e-mgr",
  },
  {
    id: "m-other",
    participantIds: ["e9"],
    participantEmployeeIds: ["e9"],
    createdByUserId: "u-mgr",
    createdBy: "u-mgr",
    createdByEmployeeId: "e-mgr",
  },
  {
    id: "m-created",
    participantIds: [],
    participantEmployeeIds: [],
    createdByUserId: "u-emp",
    createdBy: "u-emp",
    createdByEmployeeId: "e1",
  },
];

assert.deepEqual(
  filterMeetingsForActor(employee, meetings).map((item) => item.id).sort(),
  ["m-assigned", "m-created"],
);
assert.equal(filterMeetingsForActor(outsider, meetings).length, 0);
assert.equal(filterMeetingsForActor(noMeetingPerm, meetings).length, 0);
assert.equal(filterMeetingsForActor(manager, meetings).length, 3);
assert.equal(filterMeetingsForActor(owner, meetings).length, 3);
assert.equal(canSeeMeeting(employee, meetings[1]!), false);

const projects = [{ id: "p-mine" }, { id: "p-collab" }, { id: "p-secret" }, { id: "p-pending" }];
const tasks = [
  {
    projectId: "p-mine",
    status: "TODO" as const,
    createdByUserId: "u-mgr",
    assigneeId: "e1",
    collaboratorIds: [] as string[],
  },
  {
    projectId: "p-collab",
    status: "IN_PROGRESS" as const,
    createdByUserId: "u-mgr",
    assigneeId: "e9",
    collaboratorIds: ["e1"],
  },
  {
    projectId: "p-secret",
    status: "TODO" as const,
    createdByUserId: "u-mgr",
    assigneeId: "e9",
    collaboratorIds: [] as string[],
  },
  {
    projectId: "p-pending",
    status: "PENDING_APPROVAL" as const,
    createdByUserId: "u-emp",
    assigneeId: null,
    collaboratorIds: [] as string[],
  },
  {
    projectId: "p-secret",
    status: "PENDING_APPROVAL" as const,
    createdByUserId: "u-out",
    assigneeId: "e1",
    collaboratorIds: [] as string[],
  },
];

assert.equal(canListBusinessProjects(employee), true);
assert.equal(canViewAllBusinessProjects(employee), false);
assert.deepEqual(
  filterProjectsForActor(employee, projects, tasks).map((item) => item.id).sort(),
  ["p-collab", "p-mine", "p-pending"],
);
assert.ok(!filterProjectsForActor(employee, projects, tasks).some((item) => item.id === "p-secret"));
// Outsider created a pending task on p-secret → may see that project only (legitimate creator access).
assert.deepEqual(
  filterProjectsForActor(outsider, projects, tasks).map((item) => item.id),
  ["p-secret"],
);
const stranger = {
  uid: "u-stranger",
  employeeId: "e-stranger",
  isOwnerOrManager: false,
  permissions: permissionsForRole("EMPLOYEE"),
};
assert.equal(filterProjectsForActor(stranger, projects, tasks).length, 0);
assert.equal(filterProjectsForActor(manager, projects, tasks).length, 4);

// Cross-business membership gate (requireActor contract)
assert.equal(canAccessBusinessMembership({
  isSuperAdmin: false,
  memberExists: false,
  membershipActive: false,
}), false);
assert.equal(canAccessBusinessMembership({
  isSuperAdmin: false,
  memberExists: true,
  membershipActive: false,
}), false);
assert.equal(canAccessBusinessMembership({
  isSuperAdmin: false,
  memberExists: true,
  membershipActive: true,
}), true);
assert.equal(canAccessBusinessMembership({
  isSuperAdmin: true,
  memberExists: false,
  membershipActive: false,
}), true);

// GET routes must not import ensureDefaultTaskStatuses (no write on read).
const root = process.cwd();
const recordsSrc = readFileSync(join(root, "src/app/api/business/records/route.ts"), "utf8");
const statusesSrc = readFileSync(join(root, "src/app/api/business/task-statuses/route.ts"), "utf8");
assert.ok(!recordsSrc.includes("ensureDefaultTaskStatuses"));
assert.ok(recordsSrc.includes("listTaskStatusesReadOnly") || recordsSrc.includes("filterMeetingsForActor"));
assert.ok(!statusesSrc.includes("ensureDefaultTaskStatuses"));
assert.ok(statusesSrc.includes("listTaskStatusesReadOnly"));
assert.ok(recordsSrc.includes("filterMeetingsForActor"));
assert.ok(recordsSrc.includes("filterProjectsForActor"));

console.log("RECORDS_ACCESS_REGRESSION_PASS");
