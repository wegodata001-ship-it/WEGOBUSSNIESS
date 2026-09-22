"use client";

import Link from "next/link";
import { CalendarDays, Clock3, Truck } from "lucide-react";
import { DateNav, PageHeader, PrimaryButton, StatusBadge } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { employeeName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { elapsedLabel, isOverdue, openSessions, taskIsActive } from "@/lib/admin/time";
import { formatBusinessDate, todayInTimeZone } from "@/lib/dates/format";
import { useState } from "react";

export function TodayView() {
  const { business } = useBusinessContext();
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const [date, setDate] = useState(todayInTimeZone(business?.timezone));

  if (loading) return <Spinner label="טוען את היום…" />;

  const tasks = data.tasks.filter((task) =>
    task.scheduledDate === date || task.startDate === date || task.dueDate === date,
  );
  const meetings = data.meetings.filter((item) => item.date === date);
  const deadlines = data.tasks.filter((task) => task.dueDate === date && taskIsActive(task));
  const running = openSessions(data.sessions);
  const pending = data.requests.filter((item) => item.status === "PENDING" || item.status === "NEED_INFO");

  return (
    <div className="space-y-6">
      <PageHeader
        title="היום שלי"
        subtitle={formatBusinessDate(date, "he", business?.timezone)}
        actions={<DateNav value={date} onChange={setDate} />}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="משימות היום" action={<Link href="/tasks"><PrimaryButton>+ משימה חדשה</PrimaryButton></Link>}>
          {tasks.length ? tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 first:border-0">
              <div>
                <p className="text-sm font-medium">{task.title}</p>
                <p className="text-xs text-slate-500">
                  {employeeName(data.employees, task.assigneeId)}
                  {task.collaboratorIds.length ? " · משימה משותפת" : ""}
                </p>
              </div>
              <StatusBadge value={isOverdue(task, date) ? "OVERDUE" : task.status} label={labelOf(isOverdue(task, date) ? "OVERDUE" : task.status)} />
            </div>
          )) : (
            <EmptyState icon={CalendarDays} title="אין משימות פעילות כרגע" action={<Link href="/tasks"><PrimaryButton>+ יצירת משימה</PrimaryButton></Link>} />
          )}
        </SectionCard>

        <SectionCard title="פגישות היום" action={<Link href="/meetings"><PrimaryButton>+ קביעת פגישה</PrimaryButton></Link>}>
          {meetings.length ? meetings.map((meeting) => (
            <div key={meeting.id} className="border-t border-slate-100 py-2 first:border-0">
              <p className="text-sm font-medium">{meeting.title}</p>
              <p className="text-xs text-slate-500">{meeting.startTime} · {meeting.location || "ללא מיקום"}</p>
            </div>
          )) : (
            <EmptyState icon={CalendarDays} title="אין פגישות בתאריך שנבחר" action={<Link href="/meetings"><PrimaryButton>+ קביעת פגישה</PrimaryButton></Link>} />
          )}
        </SectionCard>

        <SectionCard title="Deadlines">
          {deadlines.length ? deadlines.map((task) => (
            <p key={task.id} className="border-t border-slate-100 py-2 text-sm first:border-0">{task.title}</p>
          )) : <EmptyState icon={Clock3} title="אין דדליינים ליום זה" />}
        </SectionCard>

        <SectionCard title="עובדים שעובדים עכשיו">
          {running.length ? running.map((session) => (
            <p key={session.id} className="border-t border-slate-100 py-2 text-sm first:border-0">
              {employeeName(data.employees, session.employeeId)} · {elapsedLabel(session.startedAt)}
            </p>
          )) : <EmptyState icon={Clock3} title="אין עובדים פעילים כרגע" />}
        </SectionCard>
      </div>

      <SectionCard title="בקשות שמחכות לטיפול">
        {pending.length ? pending.map((item) => (
          <div key={item.id} className="flex items-center justify-between border-t border-slate-100 py-2 first:border-0">
            <p className="text-sm">{item.title}</p>
            <StatusBadge value={item.status} label={labelOf(item.status)} />
          </div>
        )) : <EmptyState icon={Truck} title="אין בקשות שמחכות לטיפול" />}
      </SectionCard>
    </div>
  );
}
