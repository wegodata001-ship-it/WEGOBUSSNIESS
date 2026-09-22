"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { inputClass } from "@/components/admin/ui";

export function ActionSelect({
  value,
  onChange,
  emptyLabel,
  options,
  actionLabel,
  onAction,
  showAction,
}: {
  value: string;
  onChange: (next: string) => void;
  emptyLabel: string;
  options: Array<{ id: string; label: string }>;
  actionLabel: string;
  onAction: () => void;
  showAction?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((item) => item.id === value)?.label ?? emptyLabel;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" className={`${inputClass} flex items-center justify-between text-start`} onClick={() => setOpen((state) => !state)}>
        <span className="truncate">{selected}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="max-h-64 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`flex w-full rounded-xl px-3 py-2 text-start text-sm hover:bg-slate-50 ${!value ? "font-medium text-slate-900" : "text-slate-600"}`}
            >
              {emptyLabel}
            </button>
            {options.length ? <div className="my-1 border-t border-slate-100" /> : null}
            {options.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
                className={`flex w-full rounded-xl px-3 py-2 text-start text-sm hover:bg-slate-50 ${item.id === value ? "font-medium text-slate-900" : "text-slate-700"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {showAction ? (
            <>
              <div className="border-t border-slate-100" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onAction();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm font-medium text-[var(--brand-primary)] hover:bg-sky-50"
              >
                <Plus className="h-4 w-4" />
                {actionLabel}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MiniModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-16">
      <button type="button" className="absolute inset-0" aria-label="סגירה" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">סגירה</button>
        </div>
        {children}
      </div>
    </div>
  );
}
