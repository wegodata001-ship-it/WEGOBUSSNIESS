"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckSquare,
  Clock3,
  History,
  Truck,
  Users,
} from "lucide-react";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ListRow } from "@/components/ui/list-row";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { loadDashboardSnapshot, type DashboardSnapshot } from "@/lib/data/dashboard";
import { formatBusinessDate, todayInTimeZone } from "@/lib/dates/format";
import { EMPTY_DASHBOARD_KPIS } from "@/types/dashboard";

const EMPTY: DashboardSnapshot = {
  kpis: EMPTY_DASHBOARD_KPIS,
  myTasksToday: [],
  upcomingMeetings: [],
  pendingRequests: [],
  recentActivity: [],
};

export function DashboardView() {
  const { user, business, membership, permissions, isSuperAdmin } = useBusinessContext();
  const { t, locale } = useI18n();
  const [data, setData] = useState<DashboardSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const today = todayInTimeZone(business?.timezone);
  const monthPrefix = today.slice(0, 7);
  const todayLabel = formatBusinessDate(new Date(), locale, business?.timezone);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadDashboardSnapshot(business?.id ?? null, today, monthPrefix, {
      employeeId: membership?.employeeId,
      permissions,
      viewAll: isSuperAdmin,
    }).then((result) => {
      if (!active) return;
      setData(result.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [business?.id, isSuperAdmin, membership?.employeeId, monthPrefix, permissions, today]);

  if (loading) {
    return <Spinner label={t("common.loading")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            {t("dashboard.greeting", { name: user.displayName || user.email })}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("dashboard.subtitle")}</p>
        </div>
        <p className="text-sm text-slate-500">{todayLabel}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label={t("dashboard.activeTasks")} value={data.kpis.activeTasks} icon={CheckSquare} />
        <KpiCard label={t("dashboard.overdueTasks")} value={data.kpis.overdueTasks} icon={AlertTriangle} tone="warn" />
        <KpiCard label={t("dashboard.activeEmployees")} value={data.kpis.activeEmployees} icon={Users} />
        <KpiCard label={t("dashboard.monthHours")} value={data.kpis.monthWorkHours} icon={Clock3} />
        <KpiCard label={t("dashboard.upcomingMeetings")} value={data.kpis.upcomingMeetings} icon={CalendarRange} />
        <KpiCard label={t("dashboard.pendingRequests")} value={data.kpis.pendingRequests} icon={Truck} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={t("dashboard.myTasksToday")}>
          {data.myTasksToday.length ? (
            <div className="space-y-2">
              {data.myTasksToday.map((task) => (
                <ListRow key={task.id} title={task.title} meta={task.status} />
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckSquare} title={t("empty.tasks")} />
          )}
        </SectionCard>
        <SectionCard title={t("dashboard.upcomingMeetingsTitle")}>
          {data.upcomingMeetings.length ? (
            <div className="space-y-2">
              {data.upcomingMeetings.map((meeting) => (
                <ListRow
                  key={meeting.id}
                  title={meeting.title}
                  meta={`${meeting.date} ${meeting.startTime}`}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarRange} title={t("empty.meetings")} />
          )}
        </SectionCard>
        <SectionCard title={t("dashboard.pendingRequestsTitle")}>
          {data.pendingRequests.length ? (
            <div className="space-y-2">
              {data.pendingRequests.map((request) => (
                <ListRow key={request.id} title={request.title} meta={request.status} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Truck} title={t("empty.requests")} />
          )}
        </SectionCard>
        <SectionCard title={t("dashboard.recentActivity")}>
          {data.recentActivity.length ? (
            <div className="space-y-2">
              {data.recentActivity.map((item) => (
                <ListRow key={item.id} title={item.message || item.action} />
              ))}
            </div>
          ) : (
            <EmptyState icon={History} title={t("empty.activity")} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
