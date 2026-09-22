import type { BusinessStatus, Locale } from "@/types/roles";

export type Business = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  language: Locale;
  timezone: string;
  status: BusinessStatus;
  ownerUserId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};
