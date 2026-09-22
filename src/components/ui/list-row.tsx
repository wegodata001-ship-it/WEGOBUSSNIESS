import type { ReactNode } from "react";

export function ListRow({
  title,
  meta,
  badge,
}: {
  title: string;
  meta?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{title}</p>
        {meta ? <p className="truncate text-xs text-slate-500">{meta}</p> : null}
      </div>
      {badge}
    </div>
  );
}
