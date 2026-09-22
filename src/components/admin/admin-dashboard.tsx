"use client";

import Link from "next/link";
import { AlertTriangle, Briefcase, Clock3, Plus, Timer, Truck } from "lucide-react";
import { PageHeader, PrimaryButton, StatusBadge } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { employeeName, sessionHours, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { elapsedLabel, isOverdue, isUrgentTask, openSessions, taskIsActive } from "@/lib/admin/time";
import { todayInTimeZone } from "@/lib/dates/format";

export function AdminDashboard() {
  const { user, business } = useBusinessContext();
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);

  if (loading) return <Spinner label="טוען מרכז שליטה…" />;

  const activeTasks = data.tasks.filter(taskIsActive);
  const overdue = data.tasks.filter((task) => isOverdue(task, today) || (task.priority === "URGENT" && taskIsActive(task)));
  const running = openSessions(data.sessions);
  const pending = data.requests.filter((item) => item.status === "PENDING" || item.status === "NEED_INFO");
  const urgent = data.tasks.filter((task) => isUrgentTask(task, today) && taskIsActive(task)).slice(0, 6);
  const meetingsToday = data.meetings.filter((item) => item.date === today && item.status === "SCHEDULED");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`שלום, ${user.displayName || user.email}`}
        subtitle="מרכז שליטה ניהולי — תמונת מצב חיה של העסק"
        actions={
          <Link href="/tasks">
            <PrimaryButton>+ משימה חדשה</PrimaryButton>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="משימות קריטיות / באיחור" value={overdue.length} icon={AlertTriangle} tone="danger" />
        <KpiCard label="טיימרים רצים עכשיו" value={running.length} icon={Timer} tone="info" />
        <KpiCard label="בקשות ממתינות לאישור" value={pending.length} icon={Truck} tone="warn" />
        <KpiCard label="סה״כ משימות פעילות" value={activeTasks.length} icon={Briefcase} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard title="עובדים פעילים עכשיו">
            {running.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-start text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pe-3 font-medium">עובד</th>
                      <th className="py-2 pe-3 font-medium">משימה נוכחית</th>
                      <th className="py-2 pe-3 font-medium">התחלת עבודה</th>
                      <th className="py-2 pe-3 font-medium">זמן שעבר</th>
                      <th className="py-2 font-medium">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {running.map((session) => {
                      const task = data.tasks.find((item) => item.id === session.taskId);
                      return (
                        <tr key={session.id} className="border-t border-slate-100">
                          <td className="py-3 pe-3 font-medium">{employeeName(data.employees, session.employeeId)}</td>
                          <td className="py-3 pe-3">{task?.title ?? "ללא משימה"}</td>
                          <td className="py-3 pe-3">{session.startTime}</td>
                          <td className="py-3 pe-3">{elapsedLabel(session.startedAt)}</td>
                          <td className="py-3"><StatusBadge value="IN_PROGRESS" label="פעיל" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Clock3} title="אין עובדים שעובדים כרגע" description="טיימר יופיע כאן ברגע שעובד יתחיל משימה." />
            )}
          </SectionCard>
        </div>

        <SectionCard title="משימות דחופות" action={<Link className="text-sm text-[var(--brand-primary)]" href="/tasks">לכל המשימות</Link>}>
          {urgent.length ? (
            <div className="space-y-2">
              {urgent.map((task) => (
                <div key={task.id} className="rounded-xl border border-slate-100 px-3 py-2">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {employeeName(data.employees, task.assigneeId)} · {labelOf(task.priority)}
                    {task.collaboratorIds.length ? " · משימה משותפת" : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={AlertTriangle} title="אין משימות דחופות" />
          )}
        </SectionCard>
      </div>

      <SectionCard title="בריאות פרויקטים">
        {data.projects.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.projects.map((project) => {
              const tasks = data.tasks.filter((task) => task.projectId === project.id);
              const done = tasks.filter((task) => task.status === "DONE" || task.status === "COMPLETED").length;
              const open = tasks.filter(taskIsActive).length;
              const late = tasks.filter((task) => isOverdue(task, today)).length;
              const hours = sessionHours(data.sessions.filter((session) => tasks.some((task) => task.id === session.taskId)));
              const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
              const health = late > 0 ? "בסיכון" : progress >= 70 ? "תקין" : "במעקב";
              return (
                <Link key={project.id} href={`/projects/${project.id}`} className="rounded-2xl border border-slate-100 p-4 hover:border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{project.name}</p>
                      <p className="text-xs text-slate-500">{project.clientName || "ללא לקוח"}</p>
                    </div>
                    <StatusBadge value={late ? "OVERDUE" : "ACTIVE"} label={health} />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {progress}% · {hours} שעות · {open} פתוחות · {late} באיחור
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Briefcase}
            title="אין פרויקטים עדיין"
            action={<Link href="/projects"><PrimaryButton>+ יצירת פרויקט</PrimaryButton></Link>}
          />
        )}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="פגישות היום">
          {meetingsToday.length ? meetingsToday.map((meeting) => (
            <div key={meeting.id} className="border-t border-slate-100 py-2 first:border-0">
              <p className="text-sm font-medium">{meeting.title}</p>
              <p className="text-xs text-slate-500">{meeting.startTime}{meeting.endTime ? `–${meeting.endTime}` : ""} · {meeting.location || "ללא מיקום"}</p>
            </div>
          )) : (
            <EmptyState icon={Clock3} title="אין פגישות בתאריך שנבחר" action={<Link href="/meetings"><PrimaryButton>+ קביעת פגישה</PrimaryButton></Link>} />
          )}
        </SectionCard>
        <SectionCard title="בקשות שממתינות">
          {pending.length ? pending.slice(0, 6).map((item) => (
            <div key={item.id} className="border-t border-slate-100 py-2 first:border-0">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-slate-500">{labelOf(item.type)} · {employeeName(data.employees, item.requestedByEmployeeId)}</p>
            </div>
          )) : (
            <EmptyState icon={Truck} title="אין בקשות ממתינות" />
          )}
        </SectionCard>
        <SectionCard title="פעילות אחרונה">
          {data.activity.length ? data.activity.slice(0, 8).map((item) => (
            <p key={item.id} className="border-t border-slate-100 py-2 text-sm first:border-0">{item.message || item.action}</p>
          )) : (
            <EmptyState icon={Plus} title="אין פעילות אחרונה" />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
