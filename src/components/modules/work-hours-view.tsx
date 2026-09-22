"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { DataPage } from "@/components/modules/data-page";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { ListRow } from "@/components/ui/list-row";
import { Spinner } from "@/components/ui/spinner";
import { listWorkSessions } from "@/lib/data/work-hours";
import type { WorkSession } from "@/types/work-hours";

export function WorkHoursView() {
  const { business, membership, can, isSuperAdmin } = useBusinessContext();
  const { t } = useI18n();
  const [items, setItems] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const allowed = can("workHours.viewOwn") || can("workHours.viewAll");

  useEffect(() => {
    if (!allowed) {
      setItems([]);
      setLoading(false);
      return;
    }
    let active = true;
    void listWorkSessions(business?.id ?? null, {
      viewAll: isSuperAdmin || can("workHours.viewAll"),
      employeeId: membership?.employeeId,
    }).then((result) => {
      if (active) {
        setItems(result.data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [allowed, business?.id, can, isSuperAdmin, membership?.employeeId]);

  if (loading) return <Spinner label={t("common.loading")} />;

  return (
    <DataPage
      titleKey="nav.hours"
      descriptionKey="modules.hours.description"
      emptyKey="empty.hours"
      icon={Clock3}
      permission="workHours.viewOwn"
      items={items}
    >
      <div className="space-y-2">
        {items.map((session) => (
          <ListRow
            key={session.id}
            title={`${session.date} ${session.startTime}${session.endTime ? `–${session.endTime}` : ""}`}
            meta={session.status}
            badge={
              <span className="text-xs text-slate-500">
                {session.durationMinutes ? `${session.durationMinutes} ${t("hours.minutes")}` : t("hours.open")}
              </span>
            }
          />
        ))}
      </div>
    </DataPage>
  );
}
