"use client";

import { useMemo, useState } from "react";
import { AttendanceCard } from "@/components/admin/attendance-card";
import { DatePicker, Field, GhostButton, Modal, PageHeader, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { postAttendance } from "@/lib/admin/api";
import {
  attendanceSessions,
  attendanceStatusLabel,
  formatDurationWords,
  formatHoursMinutes,
  minutesInRange,
  sessionMinutes,
} from "@/lib/admin/attendance";
import { departmentName, employeeName, useBusinessCatalog } from "@/lib/admin/catalog";
import { shiftDateOnly, todayInTimeZone } from "@/lib/dates/format";
import { Spinner } from "@/components/ui/spinner";
import type { WorkSession } from "@/types/work-hours";

function csvEscape(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function AttendanceView() {
  const { t, locale } = useI18n();
  const { business, membership, can } = useBusinessContext();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const weekFrom = shiftDateOnly(today, -6);
  const monthFrom = `${today.slice(0, 7)}-01`;
  const canManage = can("workHours.manage") || membership?.role === "BUSINESS_OWNER";
  const viewAll = can("workHours.viewAll") || canManage;
  const myEmployeeId = membership?.employeeId ?? null;
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [employeeId, setEmployeeId] = useState(viewAll ? "" : myEmployeeId ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<WorkSession | null>(null);
  const [reason, setReason] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const records = useMemo(() => {
    return attendanceSessions(data.sessions).filter((session) => {
      if (session.date < from || session.date > to) return false;
      if (!viewAll && session.employeeId !== myEmployeeId) return false;
      if (employeeId && session.employeeId !== employeeId) return false;
      if (status && session.status !== status) return false;
      const employee = data.employees.find((item) => item.id === session.employeeId);
      if (departmentId && employee?.departmentId !== departmentId) return false;
      if (search && !employee?.displayName.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [data.employees, data.sessions, departmentId, employeeId, from, myEmployeeId, search, status, to, viewAll]);

  if (loading) return <Spinner label={t("common.loading")} />;
  if (!business?.id) return null;
  const businessId = business.id;

  const todaySessions = attendanceSessions(data.sessions).filter((item) => {
    if (item.date !== today) return false;
    if (!viewAll && item.employeeId !== myEmployeeId) return false;
    return true;
  });
  const present = todaySessions.filter((item) => item.status === "OPEN").length;
  const finished = todaySessions.filter((item) => item.status === "CLOSED").length;
  const clockedIds = new Set(todaySessions.map((item) => item.employeeId));
  const notIn = viewAll
    ? data.employees.filter((item) => item.status === "ACTIVE" && !clockedIds.has(item.id)).length
    : (myEmployeeId && !clockedIds.has(myEmployeeId) ? 1 : 0);
  const hoursToday = Math.round((todaySessions.reduce((sum, item) => sum + sessionMinutes(item), 0) / 60) * 10) / 10;
  const wordsLocale = locale === "ar" ? "ar" : "he";

  const selectedEmployee = employeeId || (!viewAll ? myEmployeeId : "");
  const monthMinutes = selectedEmployee ? minutesInRange(data.sessions, selectedEmployee, monthFrom, today) : 0;
  const workDays = selectedEmployee
    ? new Set(attendanceSessions(data.sessions).filter((item) => item.employeeId === selectedEmployee && item.date >= monthFrom && item.date <= today).map((item) => item.date)).size
    : 0;

  function applyQuick(kind: "today" | "week" | "month") {
    if (kind === "today") {
      setFrom(today);
      setTo(today);
      return;
    }
    if (kind === "week") {
      setFrom(weekFrom);
      setTo(today);
      return;
    }
    setFrom(monthFrom);
    setTo(today);
  }

  function exportCsv() {
    const header = [t("attendance.employee"), t("attendance.department"), t("attendance.date"), t("attendance.in"), t("attendance.out"), t("attendance.total"), t("attendance.status"), t("attendance.note")];
    const lines = [header];
    const groups = new Map<string, WorkSession[]>();
    for (const row of records) {
      const list = groups.get(row.employeeId) ?? [];
      list.push(row);
      groups.set(row.employeeId, list);
    }
    for (const [id, rows] of groups) {
      let total = 0;
      for (const session of rows) {
        const minutes = sessionMinutes(session);
        total += minutes;
        lines.push([
          employeeName(data.employees, session.employeeId),
          departmentName(data.departments, data.employees.find((item) => item.id === session.employeeId)?.departmentId),
          session.date,
          session.startTime,
          session.endTime ?? "—",
          formatHoursMinutes(minutes),
          attendanceStatusLabel(session.status, wordsLocale),
          session.note ?? "",
        ]);
      }
      lines.push([employeeName(data.employees, id), "", "", "", t("attendance.total"), formatHoursMinutes(total), "", ""]);
    }
    const blob = new Blob([`\uFEFF${lines.map((row) => row.map(csvEscape).join(",")).join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wego-attendance.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveEdit() {
    if (!edit || !reason.trim()) return;
    setBusy(true);
    try {
      await postAttendance("correct", {
        businessId,
        sessionId: edit.id,
        date: edit.date,
        clockIn,
        clockOut,
        reason: reason.trim(),
        note,
      });
      setEdit(null);
      setReason("");
      await reload({ silent: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={viewAll ? t("attendance.titleSheet") : t("attendance.titleMine")}
        actions={
          viewAll ? (
            <>
              <PrimaryButton onClick={exportCsv}>{t("attendance.exportExcel")}</PrimaryButton>
              <PrimaryButton onClick={() => window.print()}>{t("attendance.exportPdf")}</PrimaryButton>
            </>
          ) : null
        }
      />

      <AttendanceCard
        businessId={business.id}
        employeeId={myEmployeeId}
        sessions={data.sessions}
        onChanged={() => reload({ silent: true })}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Summary label={t("attendance.presentNow")} value={present} />
        <Summary label={t("attendance.notInToday")} value={notIn} />
        <Summary label={t("attendance.finishedToday")} value={finished} />
        <Summary label={t("attendance.hoursToday")} value={hoursToday} />
      </div>

      {selectedEmployee ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Summary label={t("attendance.monthHours")} value={formatHoursMinutes(monthMinutes)} />
          <Summary label={t("attendance.workDays")} value={workDays} />
          <Summary label={t("attendance.avgHours")} value={workDays ? formatHoursMinutes(Math.round(monthMinutes / workDays)) : "0:00"} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <GhostButton onClick={() => applyQuick("today")}>{t("attendance.today")}</GhostButton>
        <GhostButton onClick={() => applyQuick("week")}>{t("attendance.week")}</GhostButton>
        <GhostButton onClick={() => applyQuick("month")}>{t("attendance.month")}</GhostButton>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-5">
        <DatePicker value={from} onChange={setFrom} />
        <DatePicker value={to} onChange={setTo} />
        {viewAll ? (
          <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">{t("attendance.employee")}</option>
            {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
        ) : null}
        {viewAll ? (
          <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">{t("attendance.department")}</option>
            {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        ) : null}
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t("attendance.status")}</option>
          <option value="OPEN">{t("attendance.working")}</option>
          <option value="CLOSED">{t("attendance.completed")}</option>
        </select>
        {viewAll ? (
          <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("attendance.search")} />
        ) : null}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white md:block">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-start">{t("attendance.employee")}</th>
              <th className="px-3 py-2 text-start">{t("attendance.date")}</th>
              <th className="px-3 py-2 text-start">{t("attendance.in")}</th>
              <th className="px-3 py-2 text-start">{t("attendance.out")}</th>
              <th className="px-3 py-2 text-start">{t("attendance.total")}</th>
              <th className="px-3 py-2 text-start">{t("attendance.status")}</th>
              <th className="px-3 py-2 text-start">{t("attendance.note")}</th>
              {canManage ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {records.map((session) => (
              <tr key={session.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{employeeName(data.employees, session.employeeId)}</td>
                <td className="px-3 py-2">{session.date}</td>
                <td className="px-3 py-2 tabular-nums">{session.startTime}</td>
                <td className="px-3 py-2 tabular-nums">{session.endTime ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{formatHoursMinutes(sessionMinutes(session))}</td>
                <td className="px-3 py-2">{attendanceStatusLabel(session.status, wordsLocale)}</td>
                <td className="px-3 py-2">{session.note ?? "—"}</td>
                {canManage ? (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-[#2563EB]"
                      onClick={() => {
                        setEdit(session);
                        setClockIn(session.startTime);
                        setClockOut(session.endTime ?? "");
                        setNote(session.note ?? "");
                        setReason("");
                      }}
                    >
                      {t("attendance.edit")}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {records.map((session) => (
          <button
            key={session.id}
            type="button"
            disabled={!canManage}
            onClick={() => {
              if (!canManage) return;
              setEdit(session);
              setClockIn(session.startTime);
              setClockOut(session.endTime ?? "");
              setNote(session.note ?? "");
              setReason("");
            }}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-4 text-start"
          >
            <p className="font-semibold text-[#0F172A]">{employeeName(data.employees, session.employeeId)}</p>
            <p className="text-xs text-[#64748B]">{session.date}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[#64748B]">{t("attendance.in")}</p>
                <p className="font-medium tabular-nums">{session.startTime}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B]">{t("attendance.out")}</p>
                <p className="font-medium tabular-nums">{session.endTime ?? "—"}</p>
              </div>
            </div>
            <p className="mt-3 text-sm">{t("attendance.total")}: {formatDurationWords(sessionMinutes(session), wordsLocale)}</p>
            <p className="mt-1 text-xs text-emerald-700">
              {session.status === "CLOSED" ? `✓ ${t("attendance.completed")}` : t("attendance.working")}
            </p>
          </button>
        ))}
      </div>

      {edit ? (
        <Modal title={t("attendance.edit")} onClose={() => setEdit(null)}>
          <div className="grid gap-3">
            <Field label={t("attendance.in")}>
              <input className={inputClass} dir="ltr" value={clockIn} onChange={(event) => setClockIn(event.target.value)} />
            </Field>
            <Field label={t("attendance.out")}>
              <input className={inputClass} dir="ltr" value={clockOut} onChange={(event) => setClockOut(event.target.value)} />
            </Field>
            <Field label={t("attendance.note")}>
              <input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <Field label={t("attendance.reason")}>
              <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <GhostButton onClick={() => setEdit(null)}>{t("attendance.cancel")}</GhostButton>
            <PrimaryButton disabled={busy || !reason.trim()} onClick={() => void saveEdit()}>
              {t("attendance.save")}
            </PrimaryButton>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#0F172A]">{value}</p>
    </div>
  );
}
