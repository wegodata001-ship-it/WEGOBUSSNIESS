import type { Task } from "@/types/task";
import {
  logicalStatusFromType,
  typeFromTaskStatus,
  type TaskStatusDefinition,
} from "@/types/task-status";

export function resolveTaskStatusDef(task: Task, statuses: TaskStatusDefinition[]) {
  if (task.statusId) {
    const found = statuses.find((item) => item.id === task.statusId);
    if (found) return found;
  }
  return statuses.find((item) => item.id === task.status)
    ?? statuses.find((item) => logicalStatusFromType(item.type, item.id) === task.status)
    ?? null;
}

export function taskMatchesStatusFilter(task: Task, statusId: string, statuses: TaskStatusDefinition[]) {
  if (!statusId) return true;
  if (task.statusId === statusId || task.status === statusId) return true;
  const def = statuses.find((item) => item.id === statusId);
  if (!def) return false;
  const current = resolveTaskStatusDef(task, statuses);
  if (current) return current.id === def.id;
  return typeFromTaskStatus(task.status) === def.type && logicalStatusFromType(def.type, def.id) === task.status;
}

export function workStatusOptions(statuses: TaskStatusDefinition[], canManage: boolean) {
  return statuses
    .filter((item) => item.isActive)
    .filter((item) => canManage || (item.id !== "PENDING_APPROVAL" && item.type !== "CANCELLED"))
    .filter((item) => item.id !== "PENDING_APPROVAL")
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function filterStatusChips(statuses: TaskStatusDefinition[]) {
  return statuses
    .filter((item) => item.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}
