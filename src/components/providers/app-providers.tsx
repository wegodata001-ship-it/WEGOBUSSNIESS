"use client";

import { type ReactNode } from "react";
import { AccessibilityWidget } from "@/components/a11y/accessibility-widget";
import { AuthProvider, useAuth } from "@/components/providers/auth-provider";
import { AccessibilityProvider } from "@/components/providers/a11y-provider";
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

  return (
    <I18nProvider locale={locale} persist={auth.status === "ready"}>
      <AccessibilityProvider>
        {auth.status === "ready" ? <BusinessTheme business={auth.business} /> : null}
        {children}
        <AccessibilityWidget />
      </AccessibilityProvider>
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
