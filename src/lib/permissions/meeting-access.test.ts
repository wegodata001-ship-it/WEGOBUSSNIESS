import assert from "node:assert/strict";
import { canSeeMeeting, canViewAllMeetings, filterMeetingsForActor } from "@/lib/permissions/meeting-access";
import { permissionsForRole } from "@/lib/permissions/engine";

const owner = {
  uid: "owner-1",
  employeeId: "emp-owner",
  isOwnerOrManager: true,
  permissions: permissionsForRole("BUSINESS_OWNER"),
};

const manager = {
  uid: "mgr-1",
  employeeId: "emp-mgr",
  isOwnerOrManager: true,
  permissions: permissionsForRole("MANAGER"),
};

const employee = {
  uid: "user-emp",
  employeeId: "emp-1",
  isOwnerOrManager: false,
  permissions: permissionsForRole("EMPLOYEE"),
};

const mine = {
  participantIds: ["emp-1"],
  participantEmployeeIds: ["emp-1"],
  createdByUserId: "other",
  createdBy: "other",
  createdByEmployeeId: null as string | null,
};

const theirs = {
  participantIds: ["emp-2"],
  participantEmployeeIds: ["emp-2"],
  createdByUserId: "other",
  createdBy: "other",
  createdByEmployeeId: null as string | null,
};

const createdByMe = {
  participantIds: [],
  participantEmployeeIds: [],
  createdByUserId: "user-emp",
  createdBy: "user-emp",
  createdByEmployeeId: "emp-1",
};

assert.equal(canViewAllMeetings(owner), true);
assert.equal(canViewAllMeetings(manager), true);
assert.equal(canViewAllMeetings(employee), false);

assert.equal(canSeeMeeting(employee, mine), true);
assert.equal(canSeeMeeting(employee, createdByMe), true);
assert.equal(canSeeMeeting(employee, theirs), false);
assert.equal(canSeeMeeting(manager, theirs), true);
assert.equal(canSeeMeeting(owner, theirs), true);

const filtered = filterMeetingsForActor(employee, [mine, theirs, createdByMe]);
assert.equal(filtered.length, 2);
assert.ok(filtered.includes(mine));
assert.ok(filtered.includes(createdByMe));
assert.ok(!filtered.includes(theirs));

const allForManager = filterMeetingsForActor(manager, [mine, theirs, createdByMe]);
assert.equal(allForManager.length, 3);

console.log("MEETING_ACCESS_PASS");
