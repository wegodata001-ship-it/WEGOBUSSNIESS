import { ar } from "@/lib/i18n/ar";
import { he } from "@/lib/i18n/he";
import type { MessageKey } from "@/lib/i18n/types";
import type { Locale } from "@/types/roles";

const dictionaries: Record<Locale, Record<MessageKey, string>> = { he, ar };

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string>,
) {
  let value = dictionaries[locale][key] ?? dictionaries.he[key] ?? key;
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

export type { MessageKey };
