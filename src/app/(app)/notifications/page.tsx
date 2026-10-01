"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications } from "@/components/providers/notification-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { relativeTimeLabel } from "@/lib/admin/relative-time";
import { todayInTimeZone } from "@/lib/dates/format";
import { EmptyState } from "@/components/ui/empty-state";
import { useBusinessContext } from "@/components/providers/business-context";

function dayKey(value: Date | null, timeZone: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export default function NotificationsPage() {
  const { t } = useI18n();
  const { business } = useBusinessContext();
  const { items, markRead, markAll, unread } = useNotifications();
  const timeZone = business?.timezone || "Asia/Jerusalem";
  const today = todayInTimeZone(timeZone);
  const yesterdayDate = new Date(`${today}T12:00:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(yesterdayDate);

  const groups = [
    { key: "today", label: t("notify.today"), items: items.filter((item) => dayKey(item.createdAt, timeZone) === today) },
    { key: "yesterday", label: t("notify.yesterday"), items: items.filter((item) => dayKey(item.createdAt, timeZone) === yesterday) },
    { key: "older", label: "", items: items.filter((item) => {
      const day = dayKey(item.createdAt, timeZone);
      return day && day !== today && day !== yesterday;
    }) },
  ].filter((group) => group.items.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("shell.notifications")}</h1>
        {unread ? (
          <button type="button" className="text-sm text-[#2563EB]" onClick={() => void markAll()}>
            {t("notify.markAll")}
          </button>
        ) : null}
      </div>
      {groups.length ? groups.map((group) => (
        <section key={group.key} className="space-y-2">
          {group.label ? <h2 className="text-sm font-semibold text-slate-500">{group.label}</h2> : null}
          {group.items.map((item) => (
            <Link
              key={item.id}
              href={item.href || "/notifications"}
              onClick={() => void markRead(item.id)}
              className={`block rounded-2xl border border-slate-200 bg-white p-4 ${item.isRead ? "opacity-70" : ""}`}
            >
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.body}</p>
              <p className="mt-2 text-xs text-slate-400">{relativeTimeLabel(item.createdAt)}</p>
            </Link>
          ))}
        </section>
      )) : (
        <EmptyState icon={Bell} title={t("notify.empty")} />
      )}
    </div>
  );
}
