"use client";

import { Settings } from "lucide-react";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";

export function SettingsView() {
  const { business, can } = useBusinessContext();
  const { t } = useI18n();

  if (!can("settings.manage")) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("nav.settings")}
        </h1>
        <EmptyState
          icon={Settings}
          title={t("common.noAccessTitle")}
          description={t("empty.noAccess")}
        />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("nav.settings")}
        </h1>
        <EmptyState icon={Settings} title={t("empty.settings")} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("nav.settings")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          {t("modules.settings.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[var(--radius)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow)]">
          <p className="text-xs text-slate-500">{t("settings.businessName")}</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{business.name}</p>
        </article>
        <article className="rounded-[var(--radius)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow)]">
          <p className="text-xs text-slate-500">{t("settings.timezone")}</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{business.timezone}</p>
        </article>
        <article className="rounded-[var(--radius)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow)]">
          <p className="text-xs text-slate-500">{t("settings.language")}</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{business.language}</p>
        </article>
        <article className="rounded-[var(--radius)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow)]">
          <p className="text-xs text-slate-500">{t("settings.branding")}</p>
          <div className="mt-3 flex gap-2">
            <span className="h-8 w-8 rounded-lg" style={{ background: business.primaryColor }} />
            <span className="h-8 w-8 rounded-lg" style={{ background: business.secondaryColor }} />
          </div>
        </article>
      </div>
    </div>
  );
}
