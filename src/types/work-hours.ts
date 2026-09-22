export const WORK_SESSION_STATUSES = ["OPEN", "CLOSED"] as const;
export type WorkSessionStatus = (typeof WORK_SESSION_STATUSES)[number];

export type WorkSession = {
  id: string;
  businessId: string;
  employeeId: string;
  userId: string;
  taskId: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMinutes: number | null;
  status: WorkSessionStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
};
