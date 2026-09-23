export function uniqueIds(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const id = typeof value === "string" ? value.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function normalizeTaskTeam(input: {
  assigneeId?: unknown;
  collaboratorIds?: unknown;
  assigneeEmployeeId?: unknown;
  assigneeEmployeeIds?: unknown;
  participantIds?: unknown;
}) {
  const fromParticipants = Array.isArray(input.participantIds)
    ? uniqueIds(input.participantIds.map((item) => (typeof item === "string" ? item : "")))
    : [];
  const assigneeId = typeof input.assigneeId === "string" && input.assigneeId.trim()
    ? input.assigneeId.trim()
    : typeof input.assigneeEmployeeId === "string" && input.assigneeEmployeeId.trim()
      ? input.assigneeEmployeeId.trim()
      : fromParticipants[0] ?? null;

  const fromCollaborators = Array.isArray(input.collaboratorIds) ? input.collaboratorIds : [];
  const fromLegacy = Array.isArray(input.assigneeEmployeeIds) ? input.assigneeEmployeeIds : [];
  const collaboratorIds = uniqueIds([...fromCollaborators, ...fromLegacy, ...fromParticipants].map((item) => (
    typeof item === "string" ? item : ""
  ))).filter((id) => id !== assigneeId);

  return { assigneeId, collaboratorIds };
}

export function isEmployeeOnTask(
  task: {
    assigneeId?: string | null;
    assigneeEmployeeId?: string | null;
    collaboratorIds?: string[];
    assigneeEmployeeIds?: string[];
    participantIds?: string[];
  },
  employeeId: string | null | undefined,
) {
  if (!employeeId) return false;
  return (
    task.assigneeId === employeeId
    || task.assigneeEmployeeId === employeeId
    || (task.collaboratorIds ?? []).includes(employeeId)
    || (task.assigneeEmployeeIds ?? []).includes(employeeId)
    || (task.participantIds ?? []).includes(employeeId)
  );
}

export function taskParticipantIds(task: {
  assigneeId?: string | null;
  collaboratorIds?: string[];
  assigneeEmployeeIds?: string[];
  participantIds?: string[];
}) {
  return uniqueIds([
    task.assigneeId,
    ...(task.collaboratorIds ?? []),
    ...(task.assigneeEmployeeIds ?? []),
    ...(task.participantIds ?? []),
  ]);
}

export function employeeInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}
