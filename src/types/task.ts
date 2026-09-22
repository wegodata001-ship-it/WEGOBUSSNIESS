export const TASK_STATUSES = [
  "TODO",
  "OPEN",
  "PENDING",
  "IN_PROGRESS",
  "WAITING",
  "DONE",
  "COMPLETED",
  "OVERDUE",
  "CANCELLED",
  "ARCHIVED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_WRITE_STATUSES = ["TODO", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"] as const;
export type TaskWriteStatus = (typeof TASK_WRITE_STATUSES)[number];

export const ACTIVE_TASK_STATUSES: TaskStatus[] = ["TODO", "OPEN", "PENDING", "IN_PROGRESS", "WAITING"];
export const DONE_TASK_STATUSES: TaskStatus[] = ["DONE", "COMPLETED"];
export const ARCHIVED_TASK_STATUSES: TaskStatus[] = ["ARCHIVED", "CANCELLED"];

export function isActiveTaskStatus(status: TaskStatus) {
  return ACTIVE_TASK_STATUSES.includes(status);
}

export function isDoneTaskStatus(status: TaskStatus) {
  return DONE_TASK_STATUSES.includes(status);
}

export function isArchivedTaskStatus(status: TaskStatus) {
  return ARCHIVED_TASK_STATUSES.includes(status);
}

export function displayTaskStatus(status: TaskStatus): TaskWriteStatus {
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "WAITING") return "WAITING";
  if (DONE_TASK_STATUSES.includes(status)) return "DONE";
  if (ARCHIVED_TASK_STATUSES.includes(status)) return "ARCHIVED";
  return "TODO";
}

export type Task = {
  id: string;
  businessId: string;
  seedKey: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  color: string;
  taskType: string;
  assigneeId: string | null;
  collaboratorIds: string[];
  assigneeEmployeeId: string | null;
  assigneeEmployeeIds: string[];
  departmentId: string | null;
  projectId: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  startDate: string | null;
  dueDate: string | null;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  startAt: Date | null;
  endAt: Date | null;
  createdByUserId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type TaskComment = {
  id: string;
  businessId: string;
  taskId: string;
  authorUserId: string;
  body: string;
  createdAt: Date | null;
};
