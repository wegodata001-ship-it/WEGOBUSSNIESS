"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Accessibility, X } from "lucide-react";
import { useAccessibility } from "@/components/providers/a11y-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { FONT_SCALES, type AccessibilityPrefs } from "@/lib/a11y/prefs";

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-1 py-2.5">
      <span className="text-sm text-slate-800">{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#2563EB]"
      />
    </label>
  );
}

export function AccessibilityWidget() {
  const { t } = useI18n();
  const { prefs, setPrefs, reset } = useAccessibility();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const first = panelRef.current?.querySelector<HTMLElement>("button, input");
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function patch(partial: Partial<AccessibilityPrefs>) {
    setPrefs({ ...prefs, ...partial });
  }

  const scaleIndex = Math.max(0, FONT_SCALES.indexOf(prefs.fontScale as typeof FONT_SCALES[number]));

  return (
    <div data-a11y-widget className="pointer-events-none fixed inset-0 z-[60]">
      <button
        ref={buttonRef}
        type="button"
        className="pointer-events-auto absolute start-4 bottom-24 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-lg hover:bg-slate-50 lg:bottom-6"
        aria-label={t("a11y.open")}
        aria-expanded={open}
        aria-controls="wego-a11y-panel"
        title={t("a11y.title")}
        onClick={() => setOpen((value) => !value)}
      >
        <Accessibility className="h-5 w-5" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="pointer-events-auto absolute inset-0 bg-slate-900/30 lg:bg-transparent"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div
            id="wego-a11y-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wego-a11y-title"
            className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl lg:inset-x-auto lg:start-4 lg:bottom-20 lg:w-[22rem] lg:rounded-3xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="wego-a11y-title" className="text-lg font-semibold text-slate-900">{t("a11y.title")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50"
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-2 text-sm font-medium text-slate-700">{t("a11y.fontSize")}</p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                className="h-11 rounded-xl border border-slate-200 text-sm font-semibold disabled:opacity-40"
                disabled={scaleIndex <= 0}
                onClick={() => patch({ fontScale: FONT_SCALES[scaleIndex - 1] })}
              >
                A-
              </button>
              <button
                type="button"
                className={`h-11 rounded-xl border text-sm font-semibold ${prefs.fontScale === 1 ? "border-[#2563EB] text-[#2563EB]" : "border-slate-200"}`}
                onClick={() => patch({ fontScale: 1 })}
              >
                A
              </button>
              <button
                type="button"
                className="h-11 rounded-xl border border-slate-200 text-sm font-semibold disabled:opacity-40"
                disabled={scaleIndex >= FONT_SCALES.length - 1}
                onClick={() => patch({ fontScale: FONT_SCALES[scaleIndex + 1] })}
              >
                A+
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              <ToggleRow label={t("a11y.highContrast")} checked={prefs.highContrast} onChange={(highContrast) => patch({ highContrast })} />
              <ToggleRow label={t("a11y.grayscale")} checked={prefs.grayscale} onChange={(grayscale) => patch({ grayscale })} />
              <ToggleRow label={t("a11y.highlightLinks")} checked={prefs.highlightLinks} onChange={(highlightLinks) => patch({ highlightLinks })} />
              <ToggleRow label={t("a11y.largeCursor")} checked={prefs.largeCursor} onChange={(largeCursor) => patch({ largeCursor })} />
              <ToggleRow label={t("a11y.reduceMotion")} checked={prefs.reduceMotion} onChange={(reduceMotion) => patch({ reduceMotion })} />
              <ToggleRow label={t("a11y.readableFont")} checked={prefs.readableFont} onChange={(readableFont) => patch({ readableFont })} />
            </div>

            <button
              type="button"
              onClick={reset}
              className="mt-5 h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t("a11y.reset")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
