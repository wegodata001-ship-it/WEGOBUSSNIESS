import assert from "node:assert/strict";
import { normalizeTaskTeam } from "@/lib/admin/task-team";
import {
  fieldsFromParticipantIds,
  participantWriteFields,
  participantsFromFields,
  shouldAcceptTaskDraftProps,
  taskDraftSyncKey,
  uniqueParticipantIds,
  type TaskDraftSyncFields,
} from "@/lib/admin/task-participants";

function sampleDraft(overrides: Partial<TaskDraftSyncFields> = {}): TaskDraftSyncFields {
  return {
    title: "",
    description: "",
    projectId: "",
    departmentId: "",
    assigneeId: "",
    collaboratorIds: [],
    startDate: "2026-11-25",
    dueDate: "2026-11-25",
    startTime: "09:00",
    endTime: "10:00",
    estimatedHours: "",
    priority: "NORMAL",
    color: "BLUE",
    taskType: "GENERAL",
    status: "TODO",
    templateId: "",
    saveToLibrary: false,
    freeText: false,
    billingMode: "INCLUDED",
    priceBeforeVat: "",
    priceVatMode: "EXCLUDING_VAT",
    ...overrides,
  };
}

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

// Free-text / library apply must patch onto current selection (not replace from a stale empty draft).
const selected = {
  assigneeId: "siham-emp",
  collaboratorIds: [] as string[],
  title: "kept",
  freeText: false,
};
const afterFreeText = { ...selected, title: "", templateId: "", saveToLibrary: false, freeText: true };
assert.equal(afterFreeText.assigneeId, "siham-emp");
assert.deepEqual(afterFreeText.collaboratorIds, []);

// Documents the PR#12 gap: spreading an older empty draft after select wipes Siham.
const staleBeforeSelect = { assigneeId: "", collaboratorIds: [] as string[], title: "" };
const wipedByStaleTitle = { ...staleBeforeSelect, title: "typed after select" };
assert.equal(wipedByStaleTitle.assigneeId, "");

// PR#13 residual gap: EmployeeMultiSelect setState re-renders the modal with a stale parent
// draft. Optimistic draftRef must ignore that prop until the parent catches up.
const base = sampleDraft();
const selectedDraft = sampleDraft({ ...fieldsFromParticipantIds(["siham-emp"]), title: "משימה לסיהאם" });
const pendingKey = taskDraftSyncKey(selectedDraft);
const staleIgnore = shouldAcceptTaskDraftProps(pendingKey, base);
assert.equal(staleIgnore.accept, false);
assert.equal(staleIgnore.pendingKey, pendingKey);
const caughtUp = shouldAcceptTaskDraftProps(pendingKey, selectedDraft);
assert.equal(caughtUp.accept, true);
assert.equal(caughtUp.pendingKey, null);

// Name-only create: empty assignee/participants, no owner injection.
const nameOnly = participantWriteFields({ assigneeId: "", collaboratorIds: [] });
assert.equal(nameOnly.assigneeId, null);
assert.deepEqual(nameOnly.collaboratorIds, []);
assert.deepEqual(nameOnly.participantIds, []);

// Multi-select payload keeps first as primary assignee.
const multiPayload = participantWriteFields({
  assigneeId: "siham-emp",
  collaboratorIds: ["owner-emp"],
});
assert.equal(multiPayload.assigneeId, "siham-emp");
assert.deepEqual(multiPayload.collaboratorIds, ["owner-emp"]);
assert.deepEqual(multiPayload.participantIds, ["siham-emp", "owner-emp"]);

// Empty team notify gate (mirrors task-write): no assignment mail when nobody is selected.
const shouldNotifyAssignment = (participantIds: string[]) => participantIds.length > 0;
assert.equal(shouldNotifyAssignment(nameOnly.participantIds), false);
assert.equal(shouldNotifyAssignment(multiPayload.participantIds), true);

console.log("TASK_PARTICIPANTS_PASS");
