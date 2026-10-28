"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { categoryStyles } from "@/lib/admin/category-color";
import { useI18n } from "@/components/providers/i18n-provider";
import type { DepartmentCategory } from "@/types/department";

export function CategoryPicker({
  value,
  categories,
  onChange,
  placeholder,
  disabled,
  loading,
  error,
  emptyHint,
  required,
}: {
  value: string;
  categories: DepartmentCategory[];
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  emptyHint?: string;
  required?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0 });
  const selected = categories.find((item) => item.id === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((item) => item.name.toLowerCase().includes(q));
  }, [categories, query]);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const maxHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < maxHeight && rect.top > spaceBelow
      ? Math.max(8, rect.top - maxHeight - 8)
      : rect.bottom + 8;
    setBox({ top, left: rect.left, width: rect.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const styles = selected ? categoryStyles(selected.color) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || loading}
        aria-expanded={open}
        data-required={required || undefined}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-start text-sm text-slate-900 disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected ? (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: styles?.badgeText || "#64748b" }} />
              <span className="truncate font-medium">{selected.name}</span>
            </>
          ) : (
            <span className="text-slate-500">{loading ? t("common.loading") : placeholder || t("projects.pickCategory")}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      {!loading && !error && categories.length === 0 ? (
        <p className="mt-1 text-xs text-amber-700">{emptyHint || t("projects.noCategories")}</p>
      ) : null}
      {open && typeof document !== "undefined"
        ? createPortal(
          <>
            <button type="button" className="fixed inset-0 z-[80]" aria-label={t("common.close")} onClick={() => setOpen(false)} />
            <div
              className="fixed z-[81] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              style={{ top: box.top, left: box.left, width: Math.max(box.width, 240), maxHeight: 280 }}
              dir="rtl"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("common.search")}
                  className="h-9 w-full bg-transparent text-sm outline-none"
                />
              </div>
              <div className="max-h-52 overflow-y-auto py-1">
                {filtered.length ? filtered.map((item) => {
                  const color = categoryStyles(item.color);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onChange(item.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm hover:bg-slate-50 ${item.id === value ? "bg-slate-50 font-semibold" : ""}`}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color.badgeText }} />
                      <span className="truncate">{item.name}</span>
                    </button>
                  );
                }) : (
                  <p className="px-3 py-4 text-sm text-slate-500">{t("common.noResults")}</p>
                )}
              </div>
            </div>
          </>,
          document.body,
        )
        : null}
    </div>
  );
}
