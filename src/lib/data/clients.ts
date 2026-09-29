import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { BusinessClient } from "@/types/client";

export async function listBusinessClients(businessId: string | null) {
  return fetchBusinessRecords<BusinessClient[]>(businessId, "clients", []);
}
