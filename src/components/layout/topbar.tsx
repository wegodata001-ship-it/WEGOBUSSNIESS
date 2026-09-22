"use client";

import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { useAppSession } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatBusinessDate } from "@/lib/dates/format";
import { APP_NAME } from "@/lib/env";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user, business } = useAppSession();
  const { t, locale } = useI18n();
  const today = formatBusinessDate(new Date(), locale, business?.timezone);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[var(--line)] bg-white/90 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 lg:hidden"
          aria-label={t("shell.openMenu")}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {business?.name || APP_NAME}
          </p>
          <p className="truncate text-xs text-slate-500">{today}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/notifications"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label={t("shell.notifications")}
        >
          <Bell className="h-4 w-4" />
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)] text-sm font-semibold text-white">
            {(user.displayName || user.email).slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">
              {user.displayName || user.email}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
