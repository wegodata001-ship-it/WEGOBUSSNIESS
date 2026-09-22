"use client";

import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { departmentName, sessionHours, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { isOverdue, taskIsActive } from "@/lib/admin/time";
import { todayInTimeZone } from "@/lib/dates/format";
import { CheckSquare, Clock3, FolderKanban, Users } from "lucide-react";

function Bars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return <EmptyState icon={BarChart3} title="אין נתונים לגרף זה" />;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BiView() {
  const { business } = useBusinessContext();
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const month = today.slice(0, 7);

  if (loading) return <Spinner label="טוען בינה עסקית…" />;

  const monthSessions = data.sessions.filter((item) => item.date.startsWith(month));
  const done = data.tasks.filter((task) => task.status === "DONE" || task.status === "COMPLETED");
  const late = data.tasks.filter((task) => isOverdue(task, today));
  const active = data.tasks.filter(taskIsActive);
  const completion = data.tasks.length ? Math.round((done.length / data.tasks.length) * 100) : 0;

  const hoursByEmployee = data.employees.map((employee) => ({
    label: employee.displayName,
    value: sessionHours(monthSessions.filter((item) => item.employeeId === employee.id)),
  })).filter((item) => item.value);
  const hoursByDept = data.departments.map((department) => ({
    label: department.name,
    value: sessionHours(monthSessions.filter((item) => {
      const task = data.tasks.find((row) => row.id === item.taskId);
      return task?.departmentId === department.id;
    })),
  })).filter((item) => item.value);
  const hoursByProject = data.projects.map((project) => ({
    label: project.name,
    value: sessionHours(monthSessions.filter((item) => data.tasks.find((task) => task.id === item.taskId)?.projectId === project.id)),
  })).filter((item) => item.value);

  const byStatus = ["TODO", "IN_PROGRESS", "WAITING", "DONE", "ARCHIVED"].map((status) => ({
    label: labelOf(status),
    value: data.tasks.filter((task) => {
      if (status === "TODO") return task.status === "TODO" || task.status === "OPEN" || task.status === "PENDING";
      if (status === "DONE") return task.status === "DONE" || task.status === "COMPLETED";
      if (status === "ARCHIVED") return task.status === "ARCHIVED" || task.status === "CANCELLED";
      return task.status === status;
    }).length,
  }));
  const byPriority = ["LOW", "NORMAL", "HIGH", "URGENT"].map((priority) => ({
    label: labelOf(priority),
    value: data.tasks.filter((task) => task.priority === priority).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="בינה עסקית" subtitle="שעות, השלמות וביצועים לפי עובד, מחלקה ופרויקט" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="סה״כ שעות החודש" value={sessionHours(monthSessions)} icon={Clock3} />
        <KpiCard label="משימות שהושלמו" value={done.length} icon={CheckSquare} tone="success" />
        <KpiCard label="משימות באיחור" value={late.length} icon={BarChart3} tone="danger" />
        <KpiCard label="אחוז השלמה" value={`${completion}%`} icon={CheckSquare} />
        <KpiCard label="עובדים פעילים" value={data.employees.filter((item) => item.status === "ACTIVE").length} icon={Users} />
        <KpiCard label="פרויקטים פעילים" value={data.projects.filter((item) => item.status === "ACTIVE").length} icon={FolderKanban} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="שעות לפי עובד"><Bars items={hoursByEmployee} /></SectionCard>
        <SectionCard title="שעות לפי מחלקה"><Bars items={hoursByDept} /></SectionCard>
        <SectionCard title="שעות לפי פרויקט"><Bars items={hoursByProject} /></SectionCard>
        <SectionCard title="משימות לפי סטטוס"><Bars items={byStatus} /></SectionCard>
        <SectionCard title="משימות לפי עדיפות"><Bars items={byPriority} /></SectionCard>
        <SectionCard title="Completion trend">
          <p className="text-sm text-slate-500">הושלמו {done.length} מתוך {data.tasks.length} משימות. פעילות נוכחית: {active.length}.</p>
        </SectionCard>
      </div>

      <SectionCard title="טבלת ביצועים">
        {data.employees.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 text-start font-medium">עובד</th>
                  <th className="py-2 text-start font-medium">מחלקה</th>
                  <th className="py-2 text-start font-medium">שעות</th>
                  <th className="py-2 text-start font-medium">הושלמו</th>
                  <th className="py-2 text-start font-medium">פתוחות</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((employee) => {
                  const assigned = data.tasks.filter((task) => task.assigneeId === employee.id || task.collaboratorIds.includes(employee.id));
                  return (
                    <tr key={employee.id} className="border-t border-slate-100">
                      <td className="py-2">{employee.displayName}</td>
                      <td className="py-2">{departmentName(data.departments, employee.departmentId)}</td>
                      <td className="py-2">{sessionHours(monthSessions.filter((item) => item.employeeId === employee.id))}</td>
                      <td className="py-2">{assigned.filter((task) => task.status === "DONE" || task.status === "COMPLETED").length}</td>
                      <td className="py-2">{assigned.filter(taskIsActive).length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Users} title="אין עובדים להצגה" />}
      </SectionCard>
    </div>
  );
}
