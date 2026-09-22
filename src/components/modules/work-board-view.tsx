"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { TaskCard } from "@/components/modules/task-card";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { listTasksForDate } from "@/lib/data/tasks";
import { formatBusinessDate, shiftDateOnly, todayInTimeZone } from "@/lib/dates/format";
import type { Task } from "@/types/task";

export function WorkBoardView() {
  const { business, membership, can, isSuperAdmin } = useBusinessContext();
  const { t, locale } = useI18n();
  const timezone = business?.timezone;
  const [date, setDate] = useState(() => todayInTimeZone(timezone));
  const [tasks, setTasks] = useState<Task[]>([]);
  const allowed = can("tasks.view");
  const viewAll = isSuperAdmin || can("tasks.viewAll");

  const load = useCallback(() => {
    if (!allowed) {
      setTasks([]);
      return;
    }
    void listTasksForDate(business?.id ?? null, date, {
      viewAll,
      assigneeEmployeeId: membership?.employeeId,
    }).then((result) => setTasks(result.data));
  }, [allowed, business?.id, date, membership?.employeeId, viewAll]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("nav.board")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {t("modules.board.description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDate((current) => shiftDateOnly(current, -1))}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
            {t("board.previousDay")}
          </button>
          <button
            type="button"
            onClick={() => setDate(todayInTimeZone(timezone))}
            className="inline-flex h-10 items-center rounded-xl bg-[var(--brand-primary)] px-3 text-sm font-medium text-white"
          >
            {t("board.today")}
          </button>
          <button
            type="button"
            onClick={() => setDate((current) => shiftDateOnly(current, 1))}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("board.nextDay")}
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="text-sm font-medium text-slate-600">
        {formatBusinessDate(date, locale, timezone)}
      </p>

      {!allowed ? (
        <EmptyState icon={CalendarDays} title={t("common.noAccessTitle")} description={t("empty.noAccess")} />
      ) : tasks.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t("empty.board")} />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              businessId={business!.id}
              canStart={can("tasks.start")}
              canFinish={can("tasks.complete")}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
