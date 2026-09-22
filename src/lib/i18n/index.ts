import { ar as arabicMessages } from "@/lib/i18n/ar";
import { he as hebrewMessages } from "@/lib/i18n/he";
import type { MessageKey } from "@/lib/i18n/types";
import { FALLBACK_LOCALE, resolveLocale, type Locale } from "@/types/roles";

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
    let value = dictionary[key] ?? fallback[key] ?? key;

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
