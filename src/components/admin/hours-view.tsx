"use client";

import { useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { DatePicker, PageHeader, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { formatDurationForExport, formatDurationWords } from "@/lib/admin/attendance";
import { employeeName, projectName, sessionMinutesTotal, useBusinessCatalog } from "@/lib/admin/catalog";
import { shiftDateOnly, todayInTimeZone } from "@/lib/dates/format";

function csvEscape(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function HoursView() {
  const { t, locale } = useI18n();
  const { business, membership, can } = useBusinessContext();
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const viewAll = can("workHours.viewAll") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const myEmployeeId = membership?.employeeId ?? null;
  const wordsLocale = locale === "ar" ? "ar" : "he";
  const formatMinutes = (minutes: number) => formatDurationWords(minutes, wordsLocale);
  const [from, setFrom] = useState(shiftDateOnly(today, -30));
  const [to, setTo] = useState(today);
  const [employeeId, setEmployeeId] = useState(viewAll ? "" : myEmployeeId ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [projectId, setProjectId] = useState("");

  const weekStart = shiftDateOnly(today, -6);
  const month = today.slice(0, 7);

  const scopedEmployees = useMemo(() => {
    if (viewAll) return data.employees;
    if (!myEmployeeId) return [];
    return data.employees.filter((item) => item.id === myEmployeeId);
  }, [data.employees, myEmployeeId, viewAll]);

  const scopedSessions = useMemo(() => {
    if (viewAll) return data.sessions;
    if (!myEmployeeId) return [];
    return data.sessions.filter((session) => session.employeeId === myEmployeeId);
  }, [data.sessions, myEmployeeId, viewAll]);

  const filtered = useMemo(() => scopedSessions.filter((session) => {
    if (session.date < from || session.date > to) return false;
    if (employeeId && session.employeeId !== employeeId) return false;
    if (!viewAll && session.employeeId !== myEmployeeId) return false;
    const task = data.tasks.find((item) => item.id === session.taskId);
    if (departmentId && task?.departmentId !== departmentId) return false;
    if (projectId && task?.projectId !== projectId) return false;
    return true;
  }), [data.tasks, departmentId, employeeId, from, myEmployeeId, projectId, scopedSessions, to, viewAll]);

  if (loading) return <Spinner label={t("hours.loading")} />;

  if (!viewAll && !myEmployeeId) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("nav.hours")} subtitle={t("hours.subtitle")} />
        <EmptyState icon={Clock3} title={t("attendance.noEmployee")} />
      </div>
    );
  }

  const selected = employeeId ? filtered.filter((item) => item.employeeId === employeeId) : filtered;

  function exportCsv() {
    if (!viewAll) return;
    const lines = [[t("common.date"), t("common.employee"), t("common.project"), t("docs.taskName"), t("common.start"), t("common.end"), t("hours.duration")]].concat(
      selected.map((session) => {
        const task = data.tasks.find((item) => item.id === session.taskId);
        const minutes = session.durationMinutes ?? 0;
        return [
          session.date,
          employeeName(data.employees, session.employeeId),
          projectName(data.projects, task?.projectId),
          task?.title ?? "",
          session.startTime,
          session.endTime ?? "",
          formatDurationForExport(minutes, wordsLocale),
        ];
      }),
    );
    const blob = new Blob([lines.map((row) => row.map(csvEscape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wego-hours.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.hours")}
        subtitle={t("hours.subtitle")}
        actions={
          viewAll ? (
            <>
              <PrimaryButton onClick={exportCsv}>{t("hours.exportCsv")}</PrimaryButton>
              <PrimaryButton onClick={() => window.print()}>{t("hours.exportPdf")}</PrimaryButton>
            </>
          ) : null
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label={t("hours.todayTotal")} value={formatMinutes(sessionMinutesTotal(scopedSessions.filter((item) => item.date === today)))} icon={Clock3} />
        <KpiCard label={t("attendance.week")} value={formatMinutes(sessionMinutesTotal(scopedSessions.filter((item) => item.date >= weekStart && item.date <= today)))} icon={Clock3} />
        <KpiCard label={t("attendance.month")} value={formatMinutes(sessionMinutesTotal(scopedSessions.filter((item) => item.date.startsWith(month))))} icon={Clock3} />
      </div>
      <div className={`grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 ${viewAll ? "md:grid-cols-5" : "md:grid-cols-3"}`}>
        <DatePicker value={from} onChange={setFrom} />
        <DatePicker value={to} onChange={setTo} />
        {viewAll ? (
          <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">{t("meetings.allEmployees")}</option>
            {scopedEmployees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
        ) : null}
        {viewAll ? (
          <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">{t("hours.allDepartments")}</option>
            {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        ) : null}
        <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">{t("meetings.allProjects")}</option>
          {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      {viewAll ? (
        <SectionCard title={t("hours.summaryByEmployee")}>
          {scopedEmployees.length ? (
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 text-start">{t("common.employee")}</th>
                  <th className="py-2 text-start">{t("hours.regularHours")}</th>
                  <th className="py-2 text-start">{t("hours.activeHours")}</th>
                  <th className="py-2 text-start">{t("hours.taskCount")}</th>
                </tr>
              </thead>
              <tbody>
                {scopedEmployees.map((employee) => {
                  const rows = filtered.filter((item) => item.employeeId === employee.id);
                  const open = rows.filter((item) => item.status === "OPEN");
                  return (
                    <tr key={employee.id} className="border-t border-slate-100">
                      <td className="py-2">{employee.displayName}</td>
                      <td className="py-2">{formatMinutes(sessionMinutesTotal(rows.filter((item) => item.status === "CLOSED")))}</td>
                      <td className="py-2">{formatMinutes(sessionMinutesTotal(open))}</td>
                      <td className="py-2">{new Set(rows.map((item) => item.taskId).filter(Boolean)).size}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <EmptyState icon={Clock3} title={t("empty.hours")} />}
        </SectionCard>
      ) : null}

      <SectionCard title={t("hours.details")}>
        {selected.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  {[t("common.date"), t("common.project"), t("docs.taskName"), t("common.start"), t("common.end"), t("hours.duration")].map((item) => <th key={item} className="py-2 text-start">{item}</th>)}
                </tr>
              </thead>
              <tbody>
                {selected.map((session) => {
                  const task = data.tasks.find((item) => item.id === session.taskId);
                  return (
                    <tr key={session.id} className="border-t border-slate-100">
                      <td className="py-2">{session.date}</td>
                      <td className="py-2">{projectName(data.projects, task?.projectId)}</td>
                      <td className="py-2">{task?.title ?? "—"}</td>
                      <td className="py-2">{session.startTime}</td>
                      <td className="py-2">{session.endTime ?? t("hours.open")}</td>
                      <td className="py-2">{session.durationMinutes == null ? "—" : formatMinutes(session.durationMinutes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Clock3} title={t("hours.emptyRange")} />}
      </SectionCard>
    </div>
  );
}
