import assert from "node:assert/strict";
import { normalizeTaskTeam } from "@/lib/admin/task-team";
import {
  fieldsFromParticipantIds,
  participantWriteFields,
  participantsFromFields,
  uniqueParticipantIds,
} from "@/lib/admin/task-participants";

assert.deepEqual(uniqueParticipantIds(["e1", "", "e1", "e2", null]), ["e1", "e2"]);

// Single employee alone — first id is primary assignee, no forced second person.
assert.deepEqual(fieldsFromParticipantIds(["siham-emp"]), {
  assigneeId: "siham-emp",
  collaboratorIds: [],
});
assert.deepEqual(
  participantsFromFields({ assigneeId: "siham-emp", collaboratorIds: [] }),
  ["siham-emp"],
);

const multi = fieldsFromParticipantIds(["siham-emp", "owner-emp", "siham-emp"]);
assert.deepEqual(multi, {
  assigneeId: "siham-emp",
  collaboratorIds: ["owner-emp"],
});

const write = participantWriteFields({
  assigneeId: "siham-emp",
  collaboratorIds: [],
});
assert.equal(write.assigneeId, "siham-emp");
assert.deepEqual(write.collaboratorIds, []);
assert.deepEqual(write.participantIds, ["siham-emp"]);

// Server normalize must keep a single selected employee id (document id), not drop it.
const normalized = normalizeTaskTeam({
  assigneeId: "siham-emp",
  collaboratorIds: [],
  participantIds: ["siham-emp"],
});
assert.equal(normalized.assigneeId, "siham-emp");
assert.deepEqual(normalized.collaboratorIds, []);

// Explicit empty selection stays empty (owner must not be injected by helpers).
const empty = participantWriteFields({ assigneeId: "", collaboratorIds: [] });
assert.equal(empty.assigneeId, null);
assert.deepEqual(empty.participantIds, []);

// Simulates draft updates: selecting one employee must not be wiped by a later unrelated field merge
// when the participant update is applied last with latest fieldsFromParticipantIds.
const draft = {
  title: "בדיקה",
  assigneeId: "",
  collaboratorIds: [] as string[],
  projectId: "",
};
const afterSelect = { ...draft, ...fieldsFromParticipantIds(["siham-emp"]) };
const afterTitle = { ...afterSelect, title: "משימה לסיהאם" };
assert.equal(afterTitle.assigneeId, "siham-emp");
assert.deepEqual(afterTitle.collaboratorIds, []);
assert.deepEqual(participantsFromFields(afterTitle), ["siham-emp"]);

console.log("TASK_PARTICIPANTS_PASS");
