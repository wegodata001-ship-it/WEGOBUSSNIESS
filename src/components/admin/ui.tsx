"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  buildDatePickerCells,
  normalizeDatePickerValue,
  shiftDatePickerMonth,
} from "@/lib/dates/date-picker-model";
import { isDateOnly, shiftDateOnly, todayInTimeZone } from "@/lib/dates/format";
import { statusTone } from "@/lib/admin/labels";
import { useI18n } from "@/components/providers/i18n-provider";

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
        <h1 className="page-title text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
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
  const { t } = useI18n();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-0 py-0 md:px-4 md:py-8">
      <button
        type="button"
        className="absolute inset-0 z-0"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        className="relative z-10 min-h-dvh w-full max-w-2xl rounded-none border-0 bg-white p-5 shadow-2xl md:min-h-0 md:rounded-3xl md:border md:border-slate-200 md:p-6"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            {t("common.close")}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

class DatePickerBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("DatePicker crashed", error.message, info.componentStack);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function DatePickerInner({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const model = buildDatePickerCells(value);
  const safeValue = model.value;

  function shiftMonth(delta: number) {
    onChange(shiftDatePickerMonth(safeValue, delta));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className={`${inputClass} text-start`}
      >
        {safeValue}
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg p-1 hover:bg-slate-50">
              <ChevronRight className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium">{`${model.year}-${String(model.month).padStart(2, "0")}`}</p>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg p-1 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
            {["ב", "ג", "ד", "ה", "ו", "ש", "א"].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {model.cells.map((cell, index) => (
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
                  cell === safeValue
                    ? "bg-[var(--brand-primary)] text-white"
                    : cell === model.today
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
              onChange(model.today);
              setOpen(false);
            }}
          >
            {t("common.today")}
          </button>
        </div>
      ) : null}
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
  const safeFallback = normalizeDatePickerValue(value);
  return (
    <DatePickerBoundary
      fallback={
        <input
          type="date"
          className={inputClass}
          value={safeFallback}
          onChange={(event) => onChange(normalizeDatePickerValue(event.target.value))}
        />
      }
    >
      <DatePickerInner value={value} onChange={onChange} />
    </DatePickerBoundary>
  );
}

export function DateNav({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useI18n();
  const safeValue = normalizeDatePickerValue(value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <GhostButton
        onClick={() => onChange(isDateOnly(safeValue) ? shiftDateOnly(safeValue, -1) : safeValue)}
      >
        {t("board.previousDay")}
      </GhostButton>
      <GhostButton onClick={() => onChange(todayInTimeZone())}>{t("common.today")}</GhostButton>
      <GhostButton
        onClick={() => onChange(isDateOnly(safeValue) ? shiftDateOnly(safeValue, 1) : safeValue)}
      >
        {t("board.nextDay")}
      </GhostButton>
      <div className="w-44">
        <DatePicker value={safeValue} onChange={onChange} />
      </div>
    </div>
  );
}
