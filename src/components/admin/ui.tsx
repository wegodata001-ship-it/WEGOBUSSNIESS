"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { shiftDateOnly, todayInTimeZone } from "@/lib/dates/format";
import { statusTone } from "@/lib/admin/labels";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function StatusBadge({ value, label }: { value: string; label: string }) {
  const tone = statusTone(value);
  const classes = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
    orange: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-slate-100 text-slate-600",
  }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{label}</span>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[var(--brand-primary)]";

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-0 py-0 md:px-4 md:py-8">
      <button type="button" className="absolute inset-0" aria-label="סגירה" onClick={onClose} />
      <div className="relative min-h-dvh w-full max-w-2xl rounded-none border-0 bg-white p-5 shadow-2xl md:min-h-0 md:rounded-3xl md:border md:border-slate-200 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            סגירה
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const monthStart = useMemo(() => `${value.slice(0, 7)}-01`, [value]);
  const [year, month] = monthStart.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: startWeekday + daysInMonth }, (_, index) => {
    if (index < startWeekday) return null;
    const day = index - startWeekday + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    const stamp = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
    onChange(value.slice(8) ? `${stamp.slice(0, 8)}${value.slice(8)}` : stamp);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className={`${inputClass} text-start`}
      >
        {value}
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg p-1 hover:bg-slate-50">
              <ChevronRight className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium">{value.slice(0, 7)}</p>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg p-1 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
            {["ב", "ג", "ד", "ה", "ו", "ש", "א"].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {cells.map((cell, index) => (
              <button
                key={cell ?? `e-${index}`}
                type="button"
                disabled={!cell}
                onClick={() => {
                  if (!cell) return;
                  onChange(cell);
                  setOpen(false);
                }}
                className={`h-8 rounded-lg text-sm ${
                  cell === value
                    ? "bg-[var(--brand-primary)] text-white"
                    : cell === todayInTimeZone()
                      ? "bg-amber-50 text-amber-700"
                      : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {cell ? Number(cell.slice(8)) : ""}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 w-full rounded-xl bg-slate-50 py-2 text-sm"
            onClick={() => {
              onChange(todayInTimeZone());
              setOpen(false);
            }}
          >
            היום
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function DateNav({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <GhostButton onClick={() => onChange(shiftDateOnly(value, -1))}>יום קודם</GhostButton>
      <GhostButton onClick={() => onChange(todayInTimeZone())}>היום</GhostButton>
      <GhostButton onClick={() => onChange(shiftDateOnly(value, 1))}>יום הבא</GhostButton>
      <div className="w-44">
        <DatePicker value={value} onChange={onChange} />
      </div>
    </div>
  );
}
