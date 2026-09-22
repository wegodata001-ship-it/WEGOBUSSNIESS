"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { listNotifications } from "@/lib/data/notifications";
import type { AppNotification } from "@/types/notification";

export default function NotificationsPage() {
  const { business } = useBusinessContext();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listNotifications(business?.id ?? null).then((result) => {
      setItems(result.data);
      setLoading(false);
    });
  }, [business?.id]);

  if (loading) return <Spinner label="טוען התראות…" />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">התראות</h1>
      {items.length ? items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-medium">{item.title}</p>
          <p className="mt-1 text-sm text-slate-600">{item.body}</p>
        </article>
      )) : (
        <EmptyState icon={Bell} title="אין התראות חדשות" />
      )}
    </div>
  );
}
