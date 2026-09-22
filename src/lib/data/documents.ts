import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { BusinessDocument } from "@/types/document";

export async function listDocuments(businessId: string | null) {
  return fetchBusinessRecords<BusinessDocument[]>(businessId, "documents", []);
}
