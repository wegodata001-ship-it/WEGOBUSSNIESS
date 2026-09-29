import assert from "node:assert/strict";
import { canonicalTaskStatus, taskCompletionPatch } from "@/lib/admin/task-completion";

assert.equal(canonicalTaskStatus("DONE"), "COMPLETED");
assert.equal(canonicalTaskStatus("COMPLETED"), "COMPLETED");
assert.equal(canonicalTaskStatus("TODO"), "TODO");

const now = new Date("2026-09-29T10:00:00.000Z");
const completed = taskCompletionPatch({
  previousStatus: "IN_PROGRESS",
  nextStatus: "DONE",
  actorUserId: "user-1",
  now,
});
assert.equal(completed.status, "COMPLETED");
assert.equal(completed.completedByUserId, "user-1");
assert.ok(completed.completedAt instanceof Date);
assert.equal(completed.completedDate, "2026-09-29");

const already = taskCompletionPatch({
  previousStatus: "COMPLETED",
  nextStatus: "COMPLETED",
  actorUserId: "user-2",
  now,
});
assert.equal(already.status, "COMPLETED");
assert.equal("completedAt" in already, false);

const reopen = taskCompletionPatch({
  previousStatus: "DONE",
  nextStatus: "TODO",
  actorUserId: "user-1",
  now,
});
assert.equal(reopen.status, "TODO");
assert.equal(reopen.completedAt, null);
assert.equal(reopen.completedByUserId, null);

console.log("TASK_COMPLETION_PASS");
