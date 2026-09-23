import { getAdminDb } from "@/lib/firebase/admin";
import { businessMembersPath, employeeDocPath, notificationsPath } from "@/lib/firebase/paths";

export type NotifyPayload = {
  businessId: string;
  title: string;
  body: string;
  href?: string;
  type?: string;
  entityType?: string;
  entityId?: string;
  skipUserIds?: string[];
};

export async function notifyUsers(input: NotifyPayload & { userIds: string[] }) {
  const db = getAdminDb();
  const skip = new Set((input.skipUserIds ?? []).filter(Boolean));
  const unique = [...new Set(input.userIds.filter((id) => id && !skip.has(id)))];
  await Promise.all(unique.map((userId) => db.collection(notificationsPath(input.businessId)).add({
    businessId: input.businessId,
    userId,
    type: input.type ?? "general",
    title: input.title,
    body: input.body,
    href: input.href ?? "/notifications",
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    isRead: false,
    read: false,
    createdAt: new Date(),
  })));
}

export async function notifyEmployees(input: NotifyPayload & { employeeIds: string[] }) {
  const db = getAdminDb();
  const unique = [...new Set(input.employeeIds.filter(Boolean))];
  const userIds = await Promise.all(unique.map(async (employeeId) => {
    const snap = await db.doc(employeeDocPath(input.businessId, employeeId)).get();
    return typeof snap.data()?.userId === "string" ? snap.data()!.userId as string : "";
  }));
  await notifyUsers({ ...input, userIds });
}

export async function notifyManagers(input: NotifyPayload) {
  const db = getAdminDb();
  const snap = await db.collection(businessMembersPath(input.businessId)).get();
  const userIds = snap.docs
    .filter((docSnap) => {
      const data = docSnap.data();
      const role = data.role;
      const active = data.isActive !== false;
      return active && (role === "BUSINESS_OWNER" || role === "MANAGER");
    })
    .map((docSnap) => (typeof docSnap.data().userId === "string" ? docSnap.data().userId as string : docSnap.id));
  await notifyUsers({ ...input, userIds });
}

export function taskHref(taskId: string, chat = false) {
  return chat ? `/tasks?taskId=${encodeURIComponent(taskId)}&chat=1` : `/tasks?taskId=${encodeURIComponent(taskId)}`;
}
