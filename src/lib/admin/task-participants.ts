/**
 * Pure helpers for task participant selection (employee document IDs).
 * First selected id is the primary assignee; the rest are collaborators.
 */

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
