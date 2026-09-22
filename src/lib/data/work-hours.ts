import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { WorkSession } from "@/types/work-hours";

export async function listWorkSessions(
  businessId: string | null,
  options?: { employeeId?: string | null; viewAll?: boolean },
) {
  const result = await fetchBusinessRecords<WorkSession[]>(businessId, "sessions", []);
  const data = options?.viewAll || !options?.employeeId
    ? options?.viewAll
      ? result.data
      : result.data.filter((session) => session.employeeId === options?.employeeId)
    : result.data.filter((session) => session.employeeId === options.employeeId);

  return {
    ...result,
    data: [...data].sort((left, right) => (right.startedAt?.getTime() ?? 0) - (left.startedAt?.getTime() ?? 0)),
  };
}
