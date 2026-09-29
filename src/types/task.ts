import type { TaskPaymentStatus } from "@/types/payment";

export const TASK_STATUSES = [
  "PENDING_APPROVAL",
  "TODO",
  "OPEN",
  "PENDING",
  "IN_PROGRESS",
  "WAITING",
  "DONE",
  "COMPLETED",
  "REJECTED",
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
export const HIDDEN_WORK_STATUSES: TaskStatus[] = ["PENDING_APPROVAL", "REJECTED"];

export function isActiveTaskStatus(status: TaskStatus) {
  return ACTIVE_TASK_STATUSES.includes(status);
}

export function isDoneTaskStatus(status: TaskStatus) {
  return DONE_TASK_STATUSES.includes(status);
}

export function isArchivedTaskStatus(status: TaskStatus) {
  return ARCHIVED_TASK_STATUSES.includes(status);
}

export function isPendingApproval(status: TaskStatus) {
  return status === "PENDING_APPROVAL";
}

export function isRejectedTaskStatus(status: TaskStatus) {
  return status === "REJECTED";
}

export function isHiddenFromWorkMetrics(status: TaskStatus) {
  return HIDDEN_WORK_STATUSES.includes(status);
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
  templateId: string | null;
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
  createdByEmployeeId: string | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  rejectedByUserId: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  commentCount: number;
  priceBeforeVat: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  priceIncludingVat: number | null;
  paidAmount: number;
  balanceDue: number | null;
  paymentStatus: TaskPaymentStatus | null;
  paymentIds: string[];
  legacyId: string | null;
  legacyProjectId: string | null;
  legacyAssignee: string | null;
  legacyCreatorEmail: string | null;
  legacyApprovalStatus: "APPROVED" | "PENDING" | null;
  legacyStatus: string | null;
  legacyPriority: string | null;
  legacyCategory: string | null;
  completedDate: string | null;
  completedAt: Date | null;
  completedByUserId: string | null;
  recurrence: string | null;
  isSent: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type TaskComment = {
  id: string;
  businessId: string;
  taskId: string;
  authorUserId: string;
  authorEmployeeId: string | null;
  body: string;
  mentions: string[];
  attachments: Array<{ name: string; url?: string | null }>;
  legacyId: string | null;
  legacyAuthorEmail: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type TaskActivity = {
  id: string;
  businessId: string;
  taskId: string;
  actorUserId: string;
  actorEmployeeId: string | null;
  type: string;
  message: string;
  createdAt: Date | null;
};
