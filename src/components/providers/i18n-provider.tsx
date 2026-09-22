"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { isRtlLocale, translate, type MessageKey } from "@/lib/i18n";
import { FALLBACK_LOCALE, resolveLocale, type Locale } from "@/types/roles";

type I18nContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: (key: MessageKey, vars?: Record<string, string>) => string;
};

function createI18nValue(locale: unknown): I18nContextValue {
  const safeLocale = resolveLocale(locale);
  return {
    locale: safeLocale,
    dir: isRtlLocale(safeLocale) ? "rtl" : "ltr",
    t: (key, vars) => translate(safeLocale, key, vars),
  };
}

const I18nContext = createContext<I18nContextValue>(createI18nValue(FALLBACK_LOCALE));

export function I18nProvider({
  locale,
  children,
}: {
  locale?: Locale | string | null;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => createI18nValue(locale),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
