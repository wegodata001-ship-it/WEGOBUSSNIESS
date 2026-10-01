"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { statusTone } from "@/lib/admin/labels";

export type InlineChoice = {
  id: string;
  label: string;
};

export function InlineChoiceBadge({
  value,
  label,
  toneValue,
  options,
  title,
  hint,
  disabled,
  busy,
  onSelect,
}: {
  value: string;
  label: string;
  toneValue?: string;
  options: InlineChoice[];
  title?: string;
  hint?: string;
  disabled?: boolean;
  busy?: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tone = statusTone(toneValue || value);
  const classes = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
    orange: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-slate-100 text-slate-600",
  }[tone];

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (disabled) {
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{label}</span>;
  }

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setSheet(window.matchMedia("(max-width: 767px)").matches);
          setCoords({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 240) });
          setOpen((current) => !current);
        }}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${classes} hover:ring-2 hover:ring-slate-200 disabled:opacity-60`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={title || label}
      >
        <span>{label}</span>
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className={`fixed inset-0 z-40 ${sheet ? "bg-slate-900/30" : "bg-transparent"}`}
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div
            className={sheet
              ? "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white p-4 shadow-2xl"
              : "fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"}
            style={sheet || !coords ? undefined : { top: coords.top, left: coords.left }}
          >
            {title && sheet ? <p className="mb-2 text-sm font-semibold text-[#0F172A]">{title}</p> : null}
            {hint ? <p className="mb-2 text-xs text-red-600">{hint}</p> : null}
            <div role="listbox" className="grid gap-0.5">
              {options.map((option) => {
                const selected = option.id === value;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={busy}
                    onClick={() => {
                      setOpen(false);
                      if (!selected) onSelect(option.id);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-start text-sm md:py-1.5 ${selected ? "bg-slate-100 font-medium text-[#0F172A]" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? "border-[#2563EB] text-[#2563EB]" : "border-slate-300"}`}>
                      {selected ? "●" : ""}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
