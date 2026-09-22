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
  if (value === "ar" || value === "he") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "ar" || normalized === "he") {
      return normalized;
    }
  }

  return FALLBACK_LOCALE;
}
