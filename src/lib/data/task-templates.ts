import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { TaskTemplate } from "@/types/task-template";

export async function listTaskTemplates(businessId: string | null) {
  return fetchBusinessRecords<TaskTemplate[]>(businessId, "taskTemplates", []);
}
