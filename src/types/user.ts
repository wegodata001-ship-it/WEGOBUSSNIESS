import type { Locale, PlatformRole } from "@/types/roles";

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  photoUrl: string | null;
  platformRole: PlatformRole;
  defaultBusinessId: string | null;
  locale: Locale;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};
