"use client";

import { Clock3, LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { GhostButton, Modal, PrimaryButton } from "@/components/admin/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { postAttendance } from "@/lib/admin/api";
import {
  formatHoursMinutes,
  formatLiveDuration,
  openAttendanceFor,
  sessionMinutes,
} from "@/lib/admin/attendance";
import type { WorkSession } from "@/types/work-hours";

export function AttendanceCard({
  businessId,
  employeeId,
  sessions,
  onChanged,
}: {
  businessId: string;
  employeeId: string | null;
  sessions: WorkSession[];
  onChanged: () => Promise<void> | void;
}) {
  const { t } = useI18n();
  const open = openAttendanceFor(sessions, employeeId);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open?.startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open?.startedAt]);

  async function clockIn() {
    if (!employeeId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await postAttendance("clock-in", { businessId });
      await onChanged();
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "";
      setError(code === "ALREADY_OPEN" ? t("attendance.workingNow") : t("attendance.noEmployee"));
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await postAttendance("clock-out", { businessId });
      setConfirm(false);
      await onChanged();
    } catch {
      setError(t("attendance.noEmployee"));
    } finally {
      setBusy(false);
    }
  }

  if (!employeeId) {
    return (
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-base font-semibold text-[#0F172A]">{t("attendance.workDay")}</h2>
        <p className="mt-2 text-sm text-[#64748B]">{t("attendance.noEmployee")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-base font-semibold text-[#0F172A]">{t("attendance.workDay")}</h2>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {open ? (
        <div className="mt-4">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {t("attendance.workingNow")}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#F5F7FB] px-3 py-3">
              <p className="text-xs text-[#64748B]">{t("attendance.clockInAt")}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-[#0F172A]">{open.startTime || "—"}</p>
            </div>
            <div className="rounded-xl bg-[#F5F7FB] px-3 py-3">
              <p className="text-xs text-[#64748B]">{t("attendance.worked")}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-[#0F172A]">
                {formatLiveDuration(open.startedAt, now)}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm(true)}
            className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0F172A] text-sm font-semibold text-white transition hover:bg-[#1E293B] disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {t("attendance.clockOut")}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-[#64748B]">{t("attendance.notStarted")}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void clockIn()}
            className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            <Clock3 className="h-4 w-4" />
            {t("attendance.clockIn")}
          </button>
        </div>
      )}

      {confirm && open ? (
        <Modal title={t("attendance.confirmTitle")} onClose={() => setConfirm(false)}>
          <p className="text-sm text-slate-600">{t("attendance.confirmIn", { time: open.startTime || "—" })}</p>
          <p className="mt-2 text-sm text-slate-600">
            {t("attendance.confirmDuration", { time: formatHoursMinutes(sessionMinutes(open, now)) })}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <GhostButton onClick={() => setConfirm(false)}>{t("attendance.cancel")}</GhostButton>
            <PrimaryButton disabled={busy} onClick={() => void clockOut()}>
              {t("attendance.clockOut")}
            </PrimaryButton>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
