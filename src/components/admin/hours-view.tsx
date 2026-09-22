"use client";

import { useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { DatePicker, PageHeader, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { employeeName, projectName, sessionHours, useBusinessCatalog } from "@/lib/admin/catalog";
import { shiftDateOnly, todayInTimeZone } from "@/lib/dates/format";

function csvEscape(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function HoursView() {
  const { business } = useBusinessContext();
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const [from, setFrom] = useState(shiftDateOnly(today, -30));
  const [to, setTo] = useState(today);
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [projectId, setProjectId] = useState("");

  const weekStart = shiftDateOnly(today, -6);
  const month = today.slice(0, 7);

  const filtered = useMemo(() => data.sessions.filter((session) => {
    if (session.date < from || session.date > to) return false;
    if (employeeId && session.employeeId !== employeeId) return false;
    const task = data.tasks.find((item) => item.id === session.taskId);
    if (departmentId && task?.departmentId !== departmentId) return false;
    if (projectId && task?.projectId !== projectId) return false;
    return true;
  }), [data.sessions, data.tasks, departmentId, employeeId, from, projectId, to]);

  if (loading) return <Spinner label="טוען שעות…" />;

  const selected = employeeId ? filtered.filter((item) => item.employeeId === employeeId) : filtered;

  function exportCsv() {
    const lines = [["תאריך", "עובד", "פרויקט", "משימה", "התחלה", "סיום", "משך"]].concat(
      selected.map((session) => {
        const task = data.tasks.find((item) => item.id === session.taskId);
        return [
          session.date,
          employeeName(data.employees, session.employeeId),
          projectName(data.projects, task?.projectId),
          task?.title ?? "",
          session.startTime,
          session.endTime ?? "",
          String(session.durationMinutes ?? 0),
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
        title="דוחות שעות"
        subtitle="סיכום יומי, שבועי וחודשי לפי עובד, מחלקה ופרויקט"
        actions={
          <>
            <PrimaryButton onClick={exportCsv}>ייצוא CSV</PrimaryButton>
            <PrimaryButton onClick={() => window.print()}>ייצוא PDF</PrimaryButton>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="סה״כ שעות היום" value={sessionHours(data.sessions.filter((item) => item.date === today))} icon={Clock3} />
        <KpiCard label="השבוע" value={sessionHours(data.sessions.filter((item) => item.date >= weekStart && item.date <= today))} icon={Clock3} />
        <KpiCard label="החודש" value={sessionHours(data.sessions.filter((item) => item.date.startsWith(month)))} icon={Clock3} />
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-5">
        <DatePicker value={from} onChange={setFrom} />
        <DatePicker value={to} onChange={setTo} />
        <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          <option value="">כל העובדים</option>
          {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
        </select>
        <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          <option value="">כל המחלקות</option>
          {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">כל הפרויקטים</option>
          {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      <SectionCard title="סיכום לפי עובד">
        {data.employees.length ? (
          <table className="min-w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 text-start">עובד</th>
                <th className="py-2 text-start">שעות רגילות</th>
                <th className="py-2 text-start">שעות פעילות</th>
                <th className="py-2 text-start">מספר משימות</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((employee) => {
                const rows = filtered.filter((item) => item.employeeId === employee.id);
                const open = rows.filter((item) => item.status === "OPEN");
                return (
                  <tr key={employee.id} className="border-t border-slate-100">
                    <td className="py-2">{employee.displayName}</td>
                    <td className="py-2">{sessionHours(rows.filter((item) => item.status === "CLOSED"))}</td>
                    <td className="py-2">{sessionHours(open)}</td>
                    <td className="py-2">{new Set(rows.map((item) => item.taskId).filter(Boolean)).size}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState icon={Clock3} title="אין דיווחי שעות להצגה" />}
      </SectionCard>

      <SectionCard title="פירוט">
        {selected.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  {["תאריך", "פרויקט", "משימה", "התחלה", "סיום", "משך"].map((item) => <th key={item} className="py-2 text-start">{item}</th>)}
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
                      <td className="py-2">{session.endTime ?? "פתוח"}</td>
                      <td className="py-2">{session.durationMinutes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Clock3} title="אין דיווחי שעות בטווח שנבחר" />}
      </SectionCard>
    </div>
  );
}
