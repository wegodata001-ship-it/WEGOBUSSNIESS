import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { BusinessDocumentRecord, ServiceItem, TermsTemplate } from "@/types/business-doc";

export async function listBusinessDocs(businessId: string | null) {
  return fetchBusinessRecords<BusinessDocumentRecord[]>(businessId, "businessDocs", []);
}

export async function listTermsTemplates(businessId: string | null) {
  return fetchBusinessRecords<TermsTemplate[]>(businessId, "termsTemplates", []);
}

export async function listServiceItems(businessId: string | null) {
  return fetchBusinessRecords<ServiceItem[]>(businessId, "serviceItems", []);
}
