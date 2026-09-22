import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { LogisticsRequest } from "@/types/logistics";

export async function listBusinessRequests(businessId: string | null) {
  return fetchBusinessRecords<LogisticsRequest[]>(businessId, "requests", []);
}

export async function listPendingRequests(businessId: string | null) {
  const result = await fetchBusinessRecords<LogisticsRequest[]>(businessId, "requests", []);
  return {
    ...result,
    data: result.data.filter((item) => item.status === "PENDING"),
  };
}
