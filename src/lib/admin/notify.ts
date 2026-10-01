import { sendAdminNotification, sendEmployeeNotification, sendNotification, type NotifyInput } from "@/lib/notify/service";

export type NotifyPayload = {
  businessId: string;
  title: string;
  body: string;
  href?: string;
  type?: string;
  entityType?: string;
  entityId?: string;
  skipUserIds?: string[];
  rows?: NotifyInput["rows"];
  subject?: string;
  dedupeKey?: string;
  channels?: NotifyInput["channels"];
};

export async function notifyUsers(input: NotifyPayload & { userIds: string[] }) {
  await sendEmployeeNotification({
    businessId: input.businessId,
    type: input.type ?? "general",
    title: input.title,
    message: input.body,
    href: input.href,
    entityType: input.entityType,
    entityId: input.entityId,
    userIds: input.userIds,
    skipUserIds: input.skipUserIds,
    rows: input.rows,
    subject: input.subject,
    dedupeKey: input.dedupeKey,
    channels: input.channels,
  });
}

export async function notifyEmployees(input: NotifyPayload & { employeeIds: string[] }) {
  await sendEmployeeNotification({
    businessId: input.businessId,
    type: input.type ?? "general",
    title: input.title,
    message: input.body,
    href: input.href,
    entityType: input.entityType,
    entityId: input.entityId,
    employeeIds: input.employeeIds,
    skipUserIds: input.skipUserIds,
    rows: input.rows,
    subject: input.subject,
    dedupeKey: input.dedupeKey,
    channels: input.channels,
  });
}

export async function notifyManagers(input: NotifyPayload) {
  await sendAdminNotification({
    businessId: input.businessId,
    type: input.type ?? "general",
    title: input.title,
    message: input.body,
    href: input.href,
    entityType: input.entityType,
    entityId: input.entityId,
    skipUserIds: input.skipUserIds,
    rows: input.rows,
    subject: input.subject,
    dedupeKey: input.dedupeKey,
    channels: input.channels,
  });
}

export function taskHref(taskId: string, chat = false) {
  return chat ? `/tasks?taskId=${encodeURIComponent(taskId)}&chat=1` : `/tasks?taskId=${encodeURIComponent(taskId)}`;
}

export async function notifyUnpaidOnComplete(input: {
  businessId: string;
  taskId: string;
  title: string;
  balanceDue: number | null;
  skipUserId: string;
}) {
  if (input.balanceDue === null || input.balanceDue <= 0) return;
  await notifyManagers({
    businessId: input.businessId,
    skipUserIds: [input.skipUserId],
    title: "משימה הושלמה וממתינה לתשלום",
    body: `${input.title} הושלמה ונותרו ${input.balanceDue.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₪ לתשלום`,
    href: taskHref(input.taskId),
    type: "task.completed_unpaid",
    entityType: "task",
    entityId: input.taskId,
    dedupeKey: `PAYMENT_DUE:${input.taskId}`,
  });
}
