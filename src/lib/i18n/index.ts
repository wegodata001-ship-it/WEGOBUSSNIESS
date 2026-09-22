import { ar } from "@/lib/i18n/ar";
import { he } from "@/lib/i18n/he";
import type { MessageKey } from "@/lib/i18n/types";
import { FALLBACK_LOCALE, resolveLocale, type Locale } from "@/types/roles";

const dictionaries: Record<Locale, Record<MessageKey, string>> = { he, ar };
const hebrewDictionary = dictionaries[FALLBACK_LOCALE];

export function translate(
  locale: Locale | string | null | undefined,
  key: MessageKey,
  vars?: Record<string, string>,
) {
  const safeLocale = resolveLocale(locale);
  const currentDictionary = dictionaries[safeLocale] ?? hebrewDictionary;
  let value = currentDictionary?.[key] ?? hebrewDictionary?.[key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, replacement);
    }
  }
  return value;
}

export function isRtlLocale(locale: Locale) {
  return locale === "he" || locale === "ar";
}

export { resolveLocale, FALLBACK_LOCALE };
export type { MessageKey };
