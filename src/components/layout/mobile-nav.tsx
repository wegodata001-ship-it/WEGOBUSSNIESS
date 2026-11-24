"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, ClipboardList, Home, MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useBusinessContext } from "@/components/providers/business-context";

export function MobileNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { can, membership } = useBusinessContext();
  const [open, setOpen] = useState(false);
  const owner = membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";

  const items = [
    { href: "/dashboard", label: t("nav.home"), icon: Home },
    { href: "/tasks", label: t("nav.tasks"), icon: ClipboardList },
    { href: "/meetings", label: t("nav.meetings"), icon: CalendarRange },
  ];

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const tabClass = (active: boolean) =>
    `flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[11px] touch-manipulation ${
      active ? "text-[#2563EB]" : "text-[#475569]"
    }`;

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" data-testid="mobile-quick-sheet">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label={t("shell.closeMenu")} onClick={() => setOpen(false)} />
          <div className="absolute inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] rounded-2xl bg-white p-3 shadow-2xl">
            {can("tasks.create") || owner ? (
              <Link href="/tasks?new=1" onClick={() => setOpen(false)} className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                {t("create.task")}
              </Link>
            ) : null}
            {can("meetings.create") || can("meetings.manage") || owner ? (
              <Link href="/meetings?new=1" onClick={() => setOpen(false)} className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                {t("create.meeting")}
              </Link>
            ) : null}
            {can("logistics.create") ? (
              <Link href="/requests" onClick={() => setOpen(false)} className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                {t("create.request")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E2E8F0] bg-white/95 px-2 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
        data-testid="mobile-bottom-nav"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center">
          {items.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={tabClass(active)}>
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="-mt-5 flex h-14 w-14 items-center justify-center justify-self-center rounded-full bg-[#2563EB] text-white shadow-lg touch-manipulation"
            aria-label={t("quick.title")}
            data-testid="mobile-quick-create"
          >
            <Plus className="h-6 w-6" />
          </button>
          {items.slice(2).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={tabClass(active)}>
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button type="button" onClick={onMore} className={tabClass(false)} data-testid="mobile-nav-more">
            <MoreHorizontal className="h-5 w-5" />
            {t("nav.more")}
          </button>
        </div>
      </nav>
    </>
  );
}
