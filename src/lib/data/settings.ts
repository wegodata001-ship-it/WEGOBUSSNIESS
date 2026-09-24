import { fetchBusinessRecords } from "@/lib/data/authorized";
import { DEFAULT_BUSINESS_VAT_RATE } from "@/lib/finance/vat";
import type { BusinessSettings } from "@/types/notification";

export async function listBusinessSettings(businessId: string | null) {
  const empty: BusinessSettings = {
    id: "general",
    businessId: businessId ?? "",
    allowEmployeeSelfRequests: true,
    workWeekStart: 0,
    vatRate: DEFAULT_BUSINESS_VAT_RATE,
    updatedAt: null,
  };
  return fetchBusinessRecords<BusinessSettings>(businessId, "settings", empty);
}
