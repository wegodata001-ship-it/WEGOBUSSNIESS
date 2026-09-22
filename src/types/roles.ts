export const PLATFORM_ROLES = ["SUPER_ADMIN"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number] | null;

export const BUSINESS_ROLES = [
  "BUSINESS_OWNER",
  "MANAGER",
  "EMPLOYEE",
] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const BUSINESS_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const LOCALES = ["he", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const FALLBACK_LOCALE: Locale = "he";

export function resolveLocale(value: unknown): Locale {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (LOCALES.includes(normalized as Locale)) {
      return normalized as Locale;
    }
  }
  return FALLBACK_LOCALE;
}
