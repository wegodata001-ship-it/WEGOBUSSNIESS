export const WORK_SESSION_STATUSES = ["OPEN", "CLOSED"] as const;
export type WorkSessionStatus = (typeof WORK_SESSION_STATUSES)[number];

export const WORK_SESSION_KINDS = ["ATTENDANCE", "TASK"] as const;
export type WorkSessionKind = (typeof WORK_SESSION_KINDS)[number];

export type WorkSession = {
  id: string;
  businessId: string;
  employeeId: string;
  userId: string;
  taskId: string | null;
  kind: WorkSessionKind;
  date: string;
  startTime: string;
  endTime: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMinutes: number | null;
  status: WorkSessionStatus;
  note: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
