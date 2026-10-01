import { getAdminDb } from "@/lib/firebase/admin";
import { businessNotificationSettingsPath } from "@/lib/firebase/paths";
import { DEFAULT_NOTIFICATION_SETTINGS, mergeNotificationSettings, type NotificationSettings } from "@/lib/notify/catalog";

export async function loadNotificationSettings(businessId: string): Promise<NotificationSettings> {
  const snap = await getAdminDb().doc(businessNotificationSettingsPath(businessId)).get();
  if (!snap.exists) return DEFAULT_NOTIFICATION_SETTINGS;
  return mergeNotificationSettings(snap.data());
}

export async function saveNotificationSettings(businessId: string, next: NotificationSettings) {
  await getAdminDb().doc(businessNotificationSettingsPath(businessId)).set({
    ...mergeNotificationSettings(next),
    updatedAt: new Date(),
  }, { merge: true });
}
