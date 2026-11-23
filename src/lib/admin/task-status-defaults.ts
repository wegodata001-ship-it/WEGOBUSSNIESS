import {
  DEFAULT_TASK_STATUS_SEEDS,
  type TaskStatusDefinition,
} from "@/types/task-status";

/** In-memory defaults for GET when the collection is empty — never writes. */
export function virtualDefaultTaskStatuses(businessId: string, now = new Date()): TaskStatusDefinition[] {
  return DEFAULT_TASK_STATUS_SEEDS.map((item) => ({
    ...item,
    businessId,
    isActive: true,
    isSystem: true,
    createdAt: now,
    updatedAt: now,
  }));
}

export function sortTaskStatusDefinitions(items: TaskStatusDefinition[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
}

/** Pure GET model: never requests a database write. */
export function resolveTaskStatusesReadModel(input: {
  businessId: string;
  docs: TaskStatusDefinition[];
  now?: Date;
}): { statuses: TaskStatusDefinition[]; wrote: false } {
  if (!input.docs.length) {
    return {
      statuses: virtualDefaultTaskStatuses(input.businessId, input.now),
      wrote: false,
    };
  }
  return {
    statuses: sortTaskStatusDefinitions(input.docs),
    wrote: false,
  };
}
