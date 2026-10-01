"use client";

import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
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
  const { t } = useI18n();
  const max = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return <EmptyState icon={BarChart3} title={t("bi.noChart")} />;
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
  const { t } = useI18n();
  const { business } = useBusinessContext();
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const month = today.slice(0, 7);

  if (loading) return <Spinner label={t("bi.loading")} />;

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
      <PageHeader title={t("nav.bi")} subtitle={t("bi.subtitle")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label={t("attendance.monthHours")} value={sessionHours(monthSessions)} icon={Clock3} />
        <KpiCard label={t("bi.doneTasks")} value={done.length} icon={CheckSquare} tone="success" />
        <KpiCard label={t("dashboard.overdueTasks")} value={late.length} icon={BarChart3} tone="danger" />
        <KpiCard label={t("bi.completionRate")} value={`${completion}%`} icon={CheckSquare} />
        <KpiCard label={t("dashboard.activeEmployees")} value={data.employees.filter((item) => item.status === "ACTIVE").length} icon={Users} />
        <KpiCard label={t("bi.activeProjects")} value={data.projects.filter((item) => item.status === "ACTIVE").length} icon={FolderKanban} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title={t("bi.hoursByEmployee")}><Bars items={hoursByEmployee} /></SectionCard>
        <SectionCard title={t("bi.hoursByDept")}><Bars items={hoursByDept} /></SectionCard>
        <SectionCard title={t("bi.hoursByProject")}><Bars items={hoursByProject} /></SectionCard>
        <SectionCard title={t("bi.tasksByStatus")}><Bars items={byStatus} /></SectionCard>
        <SectionCard title={t("bi.tasksByPriority")}><Bars items={byPriority} /></SectionCard>
        <SectionCard title={t("bi.trend")}>
          <p className="text-sm text-slate-500">{t("bi.trendText", { done: String(done.length), total: String(data.tasks.length), active: String(active.length) })}</p>
        </SectionCard>
      </div>

      <SectionCard title={t("bi.performance")}>
        {data.employees.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 text-start font-medium">{t("common.employee")}</th>
                  <th className="py-2 text-start font-medium">{t("common.department")}</th>
                  <th className="py-2 text-start font-medium">{t("common.hours")}</th>
                  <th className="py-2 text-start font-medium">{t("bi.doneCol")}</th>
                  <th className="py-2 text-start font-medium">{t("bi.openCol")}</th>
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
        ) : <EmptyState icon={Users} title={t("empty.employees")} />}
      </SectionCard>
    </div>
  );
}
