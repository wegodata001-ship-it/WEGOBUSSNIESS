import { isEmployeeOnTask } from "@/lib/admin/task-team";
import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { Task } from "@/types/task";

export async function listBusinessTasks(
  businessId: string | null,
  options?: { assigneeEmployeeId?: string | null; viewAll?: boolean; includeDeleted?: boolean; deletedOnly?: boolean },
) {
  const result = await fetchBusinessRecords<Task[]>(businessId, "tasks", [], {
    includeDeleted: options?.includeDeleted,
    deletedOnly: options?.deletedOnly,
  });
  if (options?.viewAll) return result;
  if (!options?.assigneeEmployeeId) return result;
  return {
    ...result,
    data: result.data.filter((task) => isEmployeeOnTask(task, options.assigneeEmployeeId)),
  };
}

export async function listDeletedBusinessTasks(businessId: string | null) {
  return fetchBusinessRecords<Task[]>(businessId, "tasks", [], {
    includeDeleted: true,
    deletedOnly: true,
  });
}

export async function listTasksForDate(
  businessId: string | null,
  date: string,
  options?: { assigneeEmployeeId?: string | null; viewAll?: boolean },
) {
  const result = await listBusinessTasks(businessId, options);
  return {
    ...result,
    data: result.data.filter((task) =>
      task.scheduledDate === date || task.startDate === date || task.dueDate === date,
    ),
  };
}
