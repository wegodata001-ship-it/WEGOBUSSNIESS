"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications } from "@/components/providers/notification-provider";
import { relativeTimeLabel } from "@/lib/admin/relative-time";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotificationsPage() {
  const { items, markRead, markAll, unread } = useNotifications();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">התראות</h1>
        {unread ? (
          <button type="button" className="text-sm text-[#2563EB]" onClick={() => void markAll()}>
            סמן הכל כנקרא
          </button>
        ) : null}
      </div>
      {items.length ? items.map((item) => (
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
      )) : (
        <EmptyState icon={Bell} title="אין התראות חדשות" />
      )}
    </div>
  );
}
