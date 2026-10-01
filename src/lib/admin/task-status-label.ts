import { labelOf } from "@/lib/admin/labels";
import { resolveTaskStatusDef } from "@/lib/admin/task-status-resolve";
import type { Task } from "@/types/task";
import type { TaskStatusDefinition } from "@/types/task-status";

export function statusDefinitionName(item: TaskStatusDefinition, locale: string) {
  return locale === "ar" && item.nameAr ? item.nameAr : item.name;
}

export function taskStatusLabel(task: Task, statuses: TaskStatusDefinition[], locale: string) {
  const def = resolveTaskStatusDef(task, statuses);
  if (def) return statusDefinitionName(def, locale);
  return labelOf(task.status);
}
