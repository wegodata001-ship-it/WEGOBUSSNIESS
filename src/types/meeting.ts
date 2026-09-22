export const MEETING_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "DONE"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_TYPES = ["TEAM", "CLIENT", "PROJECT", "INTERNAL", "OTHER"] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_LOCATIONS = ["משרד", "Zoom", "אצל לקוח", "אחר"] as const;

export function displayMeetingStatus(status: MeetingStatus) {
  if (status === "COMPLETED" || status === "DONE") return "COMPLETED" as const;
  if (status === "CANCELLED") return "CANCELLED" as const;
  return "SCHEDULED" as const;
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  TEAM: "פגישת צוות",
  CLIENT: "פגישת לקוח",
  PROJECT: "פגישת פרויקט",
  INTERNAL: "פגישה פנימית",
  OTHER: "אחר",
};

export type Meeting = {
  id: string;
  businessId: string;
  title: string;
  description: string;
  notes: string;
  status: MeetingStatus;
  startAt: Date | null;
  endAt: Date | null;
  date: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  meetingType: MeetingType;
  color: string;
  projectId: string | null;
  participantIds: string[];
  participantEmployeeIds: string[];
  createdBy: string;
  createdByUserId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};
