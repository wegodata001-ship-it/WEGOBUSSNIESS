import type { CalendarColor } from "@/lib/admin/palette";
import type { TaskStatus } from "@/types/task";

export const TASK_STATUS_TYPES = ["TODO", "IN_PROGRESS", "WAITING", "COMPLETED", "CANCELLED"] as const;
export type TaskStatusType = (typeof TASK_STATUS_TYPES)[number];

export type TaskStatusDefinition = {
  id: string;
  businessId: string;
  name: string;
  nameAr: string;
  color: CalendarColor;
  type: TaskStatusType;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export const DEFAULT_TASK_STATUS_SEEDS: Array<{
  id: string;
  name: string;
  nameAr: string;
  color: CalendarColor;
  type: TaskStatusType;
  sortOrder: number;
}> = [
  { id: "TODO", name: "לביצוע", nameAr: "للتنفيذ", color: "BLUE", type: "TODO", sortOrder: 10 },
  { id: "IN_PROGRESS", name: "בביצוע", nameAr: "قيد التنفيذ", color: "CYAN", type: "IN_PROGRESS", sortOrder: 20 },
  { id: "WAITING", name: "ממתין ללקוח", nameAr: "بانتظار العميل", color: "ORANGE", type: "WAITING", sortOrder: 30 },
  { id: "PENDING_APPROVAL", name: "ממתין לאישור", nameAr: "بانتظار الموافقة", color: "YELLOW", type: "WAITING", sortOrder: 40 },
  { id: "COMPLETED", name: "הושלם", nameAr: "مكتمل", color: "GREEN", type: "COMPLETED", sortOrder: 50 },
  { id: "CANCELLED", name: "בוטל", nameAr: "ملغى", color: "RED", type: "CANCELLED", sortOrder: 60 },
];

export function logicalStatusFromType(type: TaskStatusType, id?: string): TaskStatus {
  if (id === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  if (id === "REJECTED") return "REJECTED";
  if (type === "COMPLETED") return "COMPLETED";
  if (type === "CANCELLED") return "CANCELLED";
  if (type === "IN_PROGRESS") return "IN_PROGRESS";
  if (type === "WAITING") return "WAITING";
  return "TODO";
}

export function typeFromTaskStatus(status: TaskStatus): TaskStatusType {
  if (status === "COMPLETED" || status === "DONE") return "COMPLETED";
  if (status === "CANCELLED" || status === "ARCHIVED" || status === "REJECTED") return "CANCELLED";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "WAITING" || status === "PENDING_APPROVAL" || status === "PENDING") return "WAITING";
  return "TODO";
}
