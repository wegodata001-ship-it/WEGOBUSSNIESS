"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import type { Locale } from "@/types/roles";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={`flex items-center gap-2 ${compact ? "" : "px-3 py-2"}`}>
      {compact ? null : <span className="text-xs text-slate-500">{t("lang.label")}</span>}
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className={`rounded-lg border border-slate-200 bg-white text-sm text-slate-700 ${compact ? "h-10 px-2" : "h-8 w-full px-2"}`}
        aria-label={t("lang.label")}
      >
        <option value="he">{t("common.hebrew")}</option>
        <option value="ar">{t("common.arabic")}</option>
      </select>
    </label>
  );
}
