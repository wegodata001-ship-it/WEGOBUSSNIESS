import { fetchBusinessRecords } from "@/lib/data/authorized";
import { toTimestamp } from "@/lib/dates/timestamp";
import type { ActivityLog } from "@/types/notification";

export async function listAllActivity(businessId: string | null) {
  const result = await fetchBusinessRecords<ActivityLog[]>(businessId, "activity", []);
  return {
    ...result,
    data: [...result.data].sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt)),
  };
}

export async function listRecentActivity(businessId: string | null) {
  const result = await listAllActivity(businessId);
  return { ...result, data: result.data.slice(0, 8) };
}
