"use client";

import Link from "next/link";
import { CalendarDays, Clock3, Truck } from "lucide-react";
import { useState } from "react";
import { AttendanceCard } from "@/components/admin/attendance-card";
import { ScheduleSection } from "@/components/admin/schedule-section";
import { DateNav, PageHeader, PrimaryButton, StatusBadge } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { attendanceSessions, formatHoursMinutes, minutesInRange, sessionMinutes } from "@/lib/admin/attendance";
import { employeeName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { isOverdue, taskIsActive } from "@/lib/admin/time";
import { formatBusinessDate, todayInTimeZone } from "@/lib/dates/format";

export function TodayView() {
  const { t, locale } = useI18n();
  const { business, membership, permissions } = useBusinessContext();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const [date, setDate] = useState(todayInTimeZone(business?.timezone));
  const employeeId = membership?.employeeId ?? null;
  const canManageMeetings = permissions.includes("meetings.manage") || permissions.includes("meetings.create") || membership?.role === "BUSINESS_OWNER";

  if (loading) return <Spinner label={t("common.loading")} />;

  const tasks = data.tasks.filter((task) =>
    (task.scheduledDate === date || task.startDate === date || task.dueDate === date)
    && (!employeeId || task.assigneeId === employeeId || task.collaboratorIds.includes(employeeId)),
  );
  const meetings = data.meetings.filter((item) =>
    item.date === date
    && (!employeeId || item.participantIds.includes(employeeId) || item.participantEmployeeIds.includes(employeeId)),
  );
  const deadlines = data.tasks.filter((task) =>
    task.dueDate === date
    && taskIsActive(task)
    && (!employeeId || task.assigneeId === employeeId || task.collaboratorIds.includes(employeeId)),
  );
  const mySessions = attendanceSessions(data.sessions).filter((item) => item.date === date && (!employeeId || item.employeeId === employeeId));
  const pending = data.requests.filter((item) => item.status === "PENDING" || item.status === "NEED_INFO");
  const dayMinutes = employeeId ? minutesInRange(data.sessions, employeeId, date, date) : mySessions.reduce((sum, item) => sum + sessionMinutes(item), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.today")}
        subtitle={formatBusinessDate(date, locale, business?.timezone)}
        actions={<DateNav value={date} onChange={setDate} />}
      />

      {business?.id ? (
        <AttendanceCard
          businessId={business.id}
          employeeId={employeeId}
          sessions={data.sessions}
          onChanged={() => reload({ silent: true })}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748B]">{t("attendance.hoursToday")}</p>
          <p className="mt-1 text-xl font-semibold">{formatHoursMinutes(dayMinutes)}</p>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#64748B]">{t("attendance.status")}</p>
          <p className="mt-1 text-xl font-semibold">
            {mySessions.some((item) => item.status === "OPEN")
              ? t("attendance.working")
              : mySessions.some((item) => item.status === "CLOSED")
                ? t("attendance.completed")
                : t("attendance.notStarted")}
          </p>
        </div>
      </div>

      {business?.id ? (
        <ScheduleSection
          title={t("schedule.mine")}
          data={data}
          today={date}
          businessId={business.id}
          employeeId={employeeId}
          canManageMeetings={canManageMeetings}
          onReload={() => reload({ silent: true })}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={t("dashboard.myTasksToday")} action={<Link href="/tasks"><PrimaryButton>+ {t("schedule.task")}</PrimaryButton></Link>}>
          {tasks.length ? tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-3 border-t border-s-4 border-slate-100 border-s-blue-500 py-2 ps-2 first:border-t-0">
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

        <SectionCard title={t("dashboard.upcomingMeetingsTitle")} action={<Link href="/meetings"><PrimaryButton>+ {t("schedule.meeting")}</PrimaryButton></Link>}>
          {meetings.length ? meetings.map((meeting) => (
            <div key={meeting.id} className="border-t border-s-4 border-slate-100 border-s-violet-500 py-2 ps-2 first:border-t-0">
              <p className="text-sm font-medium">{meeting.title}</p>
              <p className="text-xs text-slate-500">{meeting.startTime}{meeting.endTime ? `–${meeting.endTime}` : ""} · {meeting.location || "ללא מיקום"}</p>
            </div>
          )) : (
            <EmptyState icon={CalendarDays} title="אין פגישות בתאריך שנבחר" action={<Link href="/meetings"><PrimaryButton>+ קביעת פגישה</PrimaryButton></Link>} />
          )}
        </SectionCard>

        <SectionCard title={t("schedule.deadline")}>
          {deadlines.length ? deadlines.map((task) => (
            <p key={task.id} className="border-t border-s-4 border-slate-100 border-s-red-500 py-2 ps-2 text-sm first:border-t-0">{task.title}</p>
          )) : <EmptyState icon={Clock3} title="אין דדליינים ליום זה" />}
        </SectionCard>
      </div>

      <SectionCard title={t("dashboard.pendingRequestsTitle")}>
        {pending.length ? pending.map((item) => (
          <div key={item.id} className="flex items-center justify-between border-t border-s-4 border-slate-100 border-s-amber-400 py-2 ps-2 first:border-t-0">
            <p className="text-sm">{item.title}</p>
            <StatusBadge value={item.status} label={labelOf(item.status)} />
          </div>
        )) : <EmptyState icon={Truck} title="אין בקשות שמחכות לטיפול" />}
      </SectionCard>
    </div>
  );
}
