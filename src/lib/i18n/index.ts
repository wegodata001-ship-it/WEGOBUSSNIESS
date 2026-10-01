import { ar as arabicMessages } from "@/lib/i18n/ar";
import { he as hebrewMessages } from "@/lib/i18n/he";
import type { MessageKey } from "@/lib/i18n/types";
import { FALLBACK_LOCALE, resolveLocale, type Locale } from "@/types/roles";

export const LANGUAGE_STORAGE_KEY = "wego.language";

let currentLocale: Locale = FALLBACK_LOCALE;

export function getI18nLocale() {
  return currentLocale;
}

export function setI18nLocale(locale: Locale) {
  currentLocale = resolveLocale(locale);
}

function isDictionary(
  value: unknown,
): value is Record<MessageKey, string> {
  return Boolean(value) && typeof value === "object";
}

function getDictionary(locale: unknown): Record<MessageKey, string> {
  const resolvedLocale = resolveLocale(locale);

  if (resolvedLocale === "ar" && isDictionary(arabicMessages)) {
    return arabicMessages;
  }

  if (isDictionary(hebrewMessages)) {
    return hebrewMessages;
  }

  if (isDictionary(arabicMessages)) {
    return arabicMessages;
  }

  return {} as Record<MessageKey, string>;
}

export function translate(
  locale: Locale | string | null | undefined,
  key: MessageKey,
  vars?: Record<string, string>,
) {
  try {
    const dictionary = getDictionary(locale);
    const fallback = isDictionary(hebrewMessages)
      ? hebrewMessages
      : dictionary;
    const missing = dictionary[key] == null;
    let value = dictionary[key] ?? fallback[key] ?? key;
    if (missing && process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] missing ${resolveLocale(locale)} key: ${key}`);
    }

    if (vars) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.replaceAll(`{${name}}`, replacement);
      }
    }

    return value;
  } catch {
    return key;
  }
}

export function isRtlLocale(locale: Locale) {
  return locale === "he" || locale === "ar";
}

export { resolveLocale, FALLBACK_LOCALE };
export type { MessageKey };
