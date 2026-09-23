"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useBusinessContext } from "@/components/providers/business-context";
import { markNotifications } from "@/lib/business/api";
import { listNotifications } from "@/lib/data/notifications";
import { reviveSessionDates } from "@/lib/session/serialize";
import type { AppNotification } from "@/types/notification";

type NotificationContextValue = {
  items: AppNotification[];
  unread: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAll: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { business, user } = useBusinessContext();
  const [items, setItems] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    if (!business?.id) {
      setItems([]);
      return;
    }
    const result = await listNotifications(business.id);
    const mine = reviveSessionDates(result.data).filter((item) => item.userId === user.id);
    mine.sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0));
    setItems(mine);
  }, [business?.id, user.id]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    if (!business?.id) return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
    await markNotifications(business.id, { id });
  }, [business?.id]);

  const markAll = useCallback(async () => {
    if (!business?.id) return;
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    await markNotifications(business.id, { all: true });
  }, [business?.id]);

  const value = useMemo<NotificationContextValue>(() => ({
    items,
    unread: items.filter((item) => !item.isRead).length,
    refresh,
    markRead,
    markAll,
  }), [items, markAll, markRead, refresh]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) {
    return {
      items: [] as AppNotification[],
      unread: 0,
      refresh: async () => undefined,
      markRead: async () => undefined,
      markAll: async () => undefined,
    };
  }
  return value;
}
