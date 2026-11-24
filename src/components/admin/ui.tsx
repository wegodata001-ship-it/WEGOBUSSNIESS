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
  footer,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/40 px-0 py-0 md:items-start md:overflow-y-auto md:px-4 md:py-8">
      <button
        type="button"
        className="absolute inset-0 z-0"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        className="relative z-10 flex h-dvh w-full max-w-2xl flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl md:h-auto md:max-h-[min(92dvh,56rem)] md:rounded-3xl md:border md:border-slate-200"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        data-testid="app-modal"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:pt-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800">
            {t("common.close")}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6">{children}</div>
        {footer ? (
          <div
            className="shrink-0 border-t border-slate-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6"
            data-testid="app-modal-footer"
          >
            {footer}
          </div>
        ) : null}
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

function usePreferNativeDate() {
  const [native, setNative] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const sync = () => setNative(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return native;
}

function NativeDateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const safe = normalizeDatePickerValue(value);
  return (
    <input
      type="date"
      className={inputClass}
      value={safe}
      data-testid="native-date-input"
      onChange={(event) => onChange(normalizeDatePickerValue(event.target.value))}
    />
  );
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
        data-testid="custom-date-trigger"
      >
        {safeValue}
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg p-2 hover:bg-slate-50">
              <ChevronRight className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium">{`${model.year}-${String(model.month).padStart(2, "0")}`}</p>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg p-2 hover:bg-slate-50">
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
                className={`h-9 rounded-lg text-sm ${
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
            className="mt-2 w-full rounded-xl bg-slate-50 py-2.5 text-sm"
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
  const preferNative = usePreferNativeDate();
  const safeFallback = normalizeDatePickerValue(value);
  if (preferNative) {
    return <NativeDateInput value={safeFallback} onChange={onChange} />;
  }
  return (
    <DatePickerBoundary fallback={<NativeDateInput value={safeFallback} onChange={onChange} />}>
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
