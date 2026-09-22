import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { Membership } from "@/types/membership";

export async function listBusinessMembers(businessId: string | null) {
  return fetchBusinessRecords<Membership[]>(businessId, "members", []);
}
