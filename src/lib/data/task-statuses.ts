import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { TaskStatusDefinition } from "@/types/task-status";

export async function listTaskStatuses(businessId: string | null) {
  return fetchBusinessRecords<TaskStatusDefinition[]>(businessId, "taskStatuses", []);
}
