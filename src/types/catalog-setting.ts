export const CATALOG_SETTING_TYPES = ["TASK_STATUS", "TASK_PRIORITY", "PROJ_CATEGORY"] as const;
export type CatalogSettingType = (typeof CATALOG_SETTING_TYPES)[number];

export type CatalogSetting = {
  id: string;
  businessId: string;
  legacyId: string;
  type: CatalogSettingType;
  value: string;
  color: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};
