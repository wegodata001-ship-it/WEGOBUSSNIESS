"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Search, Settings, UserRound } from "lucide-react";
import { useAppSession } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { useNotifications } from "@/components/providers/notification-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { relativeTimeLabel } from "@/lib/admin/relative-time";
import { APP_NAME } from "@/lib/env";

export function Topbar({
  onOpenMenu,
  onLogout,
}: {
  onOpenMenu: () => void;
  onLogout: () => void;
}) {
  const { user, business } = useAppSession();
  const { t } = useI18n();
  const { items, unread, markRead, markAll } = useNotifications();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
      if (!bellRef.current?.contains(event.target as Node)) setBellOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(`/tasks?q=${encodeURIComponent(value)}`);
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 lg:hidden"
          aria-label={t("shell.openMenu")}
        >
          <Menu className="h-5 w-5" />
        </button>
        <form onSubmit={search} className="relative hidden min-w-0 flex-1 md:block">
          <label className="sr-only" htmlFor="wego-search">{t("shell.searchPlaceholder")}</label>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="wego-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("shell.searchPlaceholder")}
            className="h-10 w-full max-w-xl rounded-xl border border-[#E2E8F0] bg-[#F5F7FB] ps-10 pe-3 text-sm text-[#0F172A] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
          />
        </form>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:block">
          <LanguageSwitcher compact />
        </div>
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setBellOpen((value) => !value)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label={t("shell.notifications")}
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -top-1 -end-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </button>
          {bellOpen ? (
            <div className="absolute end-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-semibold">{t("shell.notifications")}</p>
                {unread ? (
                  <button type="button" className="text-xs text-[#2563EB]" onClick={() => void markAll()}>
                    {t("notify.markAll")}
                  </button>
                ) : null}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {items.slice(0, 8).map((item) => (
                  <Link
                    key={item.id}
                    href={item.href || "/notifications"}
                    onClick={() => {
                      void markRead(item.id);
                      setBellOpen(false);
                    }}
                    className={`block border-t border-slate-100 px-4 py-3 hover:bg-slate-50 ${item.isRead ? "opacity-70" : ""}`}
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                      <span className={`h-2 w-2 rounded-full ${item.isRead ? "bg-slate-300" : item.type === "task.submitted" ? "bg-amber-400" : "bg-sky-500"}`} />
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{relativeTimeLabel(item.createdAt)}</p>
                  </Link>
                ))}
                {!items.length ? <p className="px-4 py-8 text-center text-sm text-slate-400">{t("notify.empty")}</p> : null}
              </div>
              <Link href="/notifications" onClick={() => setBellOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-medium text-[#2563EB]">
                {t("notify.viewAll")}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-sm font-semibold text-white">
              {(user.displayName || user.email).slice(0, 1)}
            </span>
            <span className="hidden max-w-[140px] truncate text-sm font-medium text-[#0F172A] sm:block">
              {user.displayName || user.email}
            </span>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>
          {open ? (
            <div className="absolute end-0 z-30 mt-2 w-56 rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg">
              <LanguageSwitcher />
              <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <UserRound className="h-4 w-4" />
                {t("shell.profile")}
              </Link>
              <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Settings className="h-4 w-4" />
                {t("nav.settings")}
              </Link>
              <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <LogOut className="h-4 w-4" />
                {t("nav.logout")}
              </button>
            </div>
          ) : null}
        </div>
        <span className="sr-only">{business?.name || APP_NAME}</span>
      </div>
    </header>
  );
}
