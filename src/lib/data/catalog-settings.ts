import { fetchBusinessRecords } from "@/lib/data/authorized";
import type { CatalogSetting } from "@/types/catalog-setting";

export async function listCatalogSettings(businessId: string | null) {
  return fetchBusinessRecords<CatalogSetting[]>(businessId, "catalog", []);
}
