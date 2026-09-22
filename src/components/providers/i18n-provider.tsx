"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { isRtlLocale, translate, type MessageKey } from "@/lib/i18n";
import type { Locale } from "@/types/roles";

type I18nContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: (key: MessageKey, vars?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: isRtlLocale(locale) ? "rtl" : "ltr",
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
