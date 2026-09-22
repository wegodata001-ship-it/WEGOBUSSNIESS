import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { ActivityLog } from "@/types/notification";

export async function listAllActivity(businessId: string | null) {
  const result = await fetchBusinessRecords<ActivityLog[]>(businessId, "activity", []);
  return {
    ...result,
    data: [...result.data].sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0)),
  };
}

export async function listRecentActivity(businessId: string | null) {
  const result = await listAllActivity(businessId);
  return { ...result, data: result.data.slice(0, 8) };
}
