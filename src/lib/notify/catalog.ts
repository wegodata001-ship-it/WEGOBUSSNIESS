export type NotifyAudience = "ADMIN" | "EMPLOYEE";
export type NotifyChannel = "IN_APP" | "EMAIL";

export type ChannelPref = { inApp: boolean; email: boolean };

export const ADMIN_SETTING_KEYS = [
  "task.created",
  "task.overdue",
  "task.submitted",
  "task.completed",
  "request.created",
  "meeting.created",
  "payment.received",
] as const;

export const EMPLOYEE_SETTING_KEYS = [
  "task.assigned",
  "task.updated",
  "task.reminder",
  "task.overdue",
  "meeting.created",
  "task.mention",
] as const;

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];
export type EmployeeSettingKey = (typeof EMPLOYEE_SETTING_KEYS)[number];

export type NotificationSettings = {
  admin: Record<AdminSettingKey, ChannelPref>;
  employee: Record<EmployeeSettingKey, ChannelPref>;
  meetingReminderMinutes: number[];
  meetingReminderEmail: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  admin: {
    "task.created": { inApp: true, email: true },
    "task.overdue": { inApp: true, email: true },
    "task.submitted": { inApp: true, email: true },
    "task.completed": { inApp: true, email: false },
    "request.created": { inApp: true, email: true },
    "meeting.created": { inApp: true, email: true },
    "payment.received": { inApp: true, email: true },
  },
  employee: {
    "task.assigned": { inApp: true, email: true },
    "task.updated": { inApp: true, email: true },
    "task.reminder": { inApp: true, email: true },
    "task.overdue": { inApp: true, email: true },
    "meeting.created": { inApp: true, email: true },
    "task.mention": { inApp: true, email: true },
  },
  meetingReminderMinutes: [30],
  meetingReminderEmail: false,
};

const ADMIN_TYPES = new Set([
  "task.created",
  "task.submitted",
  "task.completed",
  "task.completed_unpaid",
  "task.overdue.admin",
  "request.created",
  "meeting.created.admin",
  "payment.received",
  "admin.digest",
]);

const CRITICAL_EMAIL = new Set([
  "task.assigned",
  "task.overdue",
  "task.rejected",
  "meeting.cancelled",
  "request.updated",
]);

export function inferAudience(type: string): NotifyAudience {
  if (ADMIN_TYPES.has(type) || type.endsWith(".admin") || type === "admin.digest") return "ADMIN";
  return "EMPLOYEE";
}

export function settingKeyFor(type: string, audience: NotifyAudience): string {
  if (audience === "ADMIN") {
    if (type === "task.completed_unpaid" || type === "task.completed") return "task.completed";
    if (type === "task.overdue" || type === "task.overdue.admin") return "task.overdue";
    if (type.startsWith("meeting.")) return "meeting.created";
    if (type.startsWith("payment.")) return "payment.received";
    if (type === "task.created") return "task.created";
    if (type === "task.submitted") return "task.submitted";
    if (type === "request.created") return "request.created";
    return "task.created";
  }
  if (type === "task.added" || type === "task.assigned") return "task.assigned";
  if (type === "task.removed" || type === "task.updated") return "task.updated";
  if (type === "task.reminder" || type === "employee.digest") return "task.reminder";
  if (type === "task.overdue") return "task.overdue";
  if (type.startsWith("meeting.")) return "meeting.created";
  if (type === "task.mention") return "task.mention";
  if (type === "request.updated") return "task.updated";
  return "task.assigned";
}

export function isCriticalEmail(type: string) {
  return CRITICAL_EMAIL.has(type);
}

export function mergeNotificationSettings(raw: unknown): NotificationSettings {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const adminRaw = data.admin && typeof data.admin === "object" ? data.admin as Record<string, ChannelPref> : {};
  const employeeRaw = data.employee && typeof data.employee === "object" ? data.employee as Record<string, ChannelPref> : {};
  const admin = { ...DEFAULT_NOTIFICATION_SETTINGS.admin };
  const employee = { ...DEFAULT_NOTIFICATION_SETTINGS.employee };
  for (const key of ADMIN_SETTING_KEYS) {
    if (adminRaw[key]) admin[key] = { inApp: adminRaw[key].inApp !== false, email: adminRaw[key].email === true };
  }
  for (const key of EMPLOYEE_SETTING_KEYS) {
    if (employeeRaw[key]) employee[key] = { inApp: employeeRaw[key].inApp !== false, email: employeeRaw[key].email === true };
  }
  const minutes = Array.isArray(data.meetingReminderMinutes)
    ? data.meetingReminderMinutes.filter((item): item is number => typeof item === "number" && item > 0)
    : DEFAULT_NOTIFICATION_SETTINGS.meetingReminderMinutes;
  return {
    admin,
    employee,
    meetingReminderMinutes: minutes.length ? minutes : [30],
    meetingReminderEmail: data.meetingReminderEmail === true,
  };
}
