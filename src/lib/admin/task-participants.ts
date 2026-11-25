/**
 * Pure helpers for task participant selection (employee document IDs).
 * First selected id is the primary assignee; the rest are collaborators.
 */

/** Minimal draft shape used to detect stale parent props after optimistic patches. */
export type TaskDraftSyncFields = {
  id?: string;
  title: string;
  assigneeId: string;
  collaboratorIds: string[];
  startDate: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  projectId: string;
  departmentId: string;
  description: string;
  estimatedHours: string;
  priority: string;
  color: string;
  taskType: string;
  status: string;
  templateId: string;
  saveToLibrary: boolean;
  freeText: boolean;
  billingMode: string;
  priceBeforeVat: string;
  priceVatMode: string;
};

export function taskDraftSyncKey(draft: TaskDraftSyncFields) {
  return [
    draft.id ?? "",
    draft.title,
    draft.assigneeId,
    draft.collaboratorIds.join(","),
    draft.startDate,
    draft.dueDate,
    draft.startTime,
    draft.endTime,
    draft.projectId,
    draft.departmentId,
    draft.description,
    draft.estimatedHours,
    draft.priority,
    draft.color,
    draft.taskType,
    draft.status,
    draft.templateId,
    draft.saveToLibrary ? "1" : "0",
    draft.freeText ? "1" : "0",
    draft.billingMode,
    draft.priceBeforeVat,
    draft.priceVatMode,
  ].join("\u0001");
}

/**
 * After EmployeeMultiSelect setState, TaskFormModal re-renders with a stale parent draft.
 * Keep optimistic draftRef until the parent catches up to the pending key.
 */
export function shouldAcceptTaskDraftProps(pendingKey: string | null, incoming: TaskDraftSyncFields) {
  const incomingKey = taskDraftSyncKey(incoming);
  if (!pendingKey) return { accept: true, pendingKey: null as string | null };
  if (incomingKey === pendingKey) return { accept: true, pendingKey: null };
  return { accept: false, pendingKey };
}

export function uniqueParticipantIds(ids: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of ids) {
    const id = typeof value === "string" ? value.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function participantsFromFields(input: {
  assigneeId?: string | null;
  collaboratorIds?: string[] | null;
}) {
  return uniqueParticipantIds([input.assigneeId, ...(input.collaboratorIds ?? [])]);
}

export function fieldsFromParticipantIds(ids: Array<string | null | undefined>) {
  const unique = uniqueParticipantIds(ids);
  return {
    assigneeId: unique[0] ?? "",
    collaboratorIds: unique.slice(1),
  };
}

/** Payload fields sent to upsertTask — always employee document ids. */
export function participantWriteFields(input: {
  assigneeId?: string | null;
  collaboratorIds?: string[] | null;
}) {
  const participants = participantsFromFields(input);
  return {
    assigneeId: participants[0] ?? null,
    collaboratorIds: participants.slice(1),
    participantIds: participants,
  };
}
