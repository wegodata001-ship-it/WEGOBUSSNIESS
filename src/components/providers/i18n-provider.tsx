"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isRtlLocale, LANGUAGE_STORAGE_KEY, setI18nLocale, translate, type MessageKey } from "@/lib/i18n";
import { FALLBACK_LOCALE, resolveLocale, type Locale } from "@/types/roles";

type I18nContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: (key: MessageKey, vars?: Record<string, string>) => string;
  setLocale: (locale: Locale) => void;
};

function applyDocumentLocale(locale: Locale) {
  const safe = resolveLocale(locale);
  setI18nLocale(safe);
  if (typeof document !== "undefined") {
    document.documentElement.lang = safe;
    document.documentElement.dir = isRtlLocale(safe) ? "rtl" : "ltr";
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, safe);
  }
}

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === "he" || saved === "ar" ? saved : null;
}

function createI18nValue(locale: Locale, setLocale: (next: Locale) => void): I18nContextValue {
  const safeLocale = resolveLocale(locale);
  return {
    locale: safeLocale,
    dir: isRtlLocale(safeLocale) ? "rtl" : "ltr",
    t: (key, vars) => translate(safeLocale, key, vars),
    setLocale,
  };
}

const I18nContext = createContext<I18nContextValue>(createI18nValue(FALLBACK_LOCALE, () => undefined));

export function I18nProvider({
  locale,
  persist = false,
  children,
}: {
  locale?: Locale | string | null;
  persist?: boolean;
  children: ReactNode;
}) {
  const [current, setCurrent] = useState<Locale>(() => readStoredLocale() || resolveLocale(locale));

  useEffect(() => {
    applyDocumentLocale(current);
  }, [current]);

  useEffect(() => {
    if (readStoredLocale()) return;
    if (locale) setCurrent(resolveLocale(locale));
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    const safe = resolveLocale(next);
    setCurrent(safe);
    applyDocumentLocale(safe);
    if (persist) {
      void fetch("/api/me/locale", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: safe }),
      }).catch(() => undefined);
    }
  }, [persist]);

  const value = useMemo(() => createI18nValue(current, setLocale), [current, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext) ?? createI18nValue(FALLBACK_LOCALE, () => undefined);
}
