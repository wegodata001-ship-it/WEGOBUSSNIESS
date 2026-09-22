"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/components/providers/auth-provider";
import { BusinessTheme } from "@/components/providers/business-theme";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { DEFAULT_LOCALE } from "@/lib/env";
import { resolveLocale } from "@/types/roles";

function LocaleBridge({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const locale = resolveLocale(
    auth.status === "ready"
      ? auth.user.locale || auth.business?.language || DEFAULT_LOCALE
      : DEFAULT_LOCALE,
  );

  const dir = locale === "ar" || locale === "he" ? "rtl" : "ltr";
  const [documentLocale, setDocumentLocale] = useState(() =>
    resolveLocale(DEFAULT_LOCALE),
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    setDocumentLocale(locale);
  }, [dir, locale]);

  return (
    <I18nProvider locale={documentLocale}>
      {auth.status === "ready" ? <BusinessTheme business={auth.business} /> : null}
      {children}
    </I18nProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LocaleBridge>{children}</LocaleBridge>
    </AuthProvider>
  );
}
