import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { AppNotification } from "@/types/notification";

export async function listNotifications(businessId: string | null) {
  return fetchBusinessRecords<AppNotification[]>(businessId, "notifications", []);
}
