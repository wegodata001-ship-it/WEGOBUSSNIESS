import type { LucideIcon } from "lucide-react";

const TONES = {
  default: "bg-[rgb(var(--brand-primary-rgb)/0.1)] text-[var(--brand-primary)]",
  warn: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
  success: "bg-emerald-50 text-emerald-600",
  info: "bg-sky-50 text-sky-600",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <article className="rounded-[var(--radius)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${TONES[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}
