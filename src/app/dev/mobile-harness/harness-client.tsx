"use client";

import { useState } from "react";
import { DatePicker, Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/admin/ui";
import { I18nProvider } from "@/components/providers/i18n-provider";

const TABS = ["סקירה", "משימות", "שעות", "מסמכים", "צוות", "פעילויות", "פרטי מערכת", "כספים"];

export function MobileHarnessClient() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("2026-11-24");
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState(TABS[0]!);
  const [saved, setSaved] = useState(false);

  return (
    <I18nProvider locale="he" persist={false}>
      <main className="min-h-dvh max-w-full overflow-x-clip bg-slate-100 p-3" data-testid="mobile-harness" dir="rtl">
        <h1 className="mb-3 text-lg font-semibold">Mobile harness</h1>
        <div className="-mx-1 mb-4 overflow-x-auto overscroll-x-contain px-1" data-testid="project-tabs">
          <div className="flex w-max gap-2">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm ${tab === item ? "bg-[#2563EB] text-white" : "bg-white text-slate-600"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-3 text-sm text-slate-600" data-testid="active-tab">{tab}</p>
        <p className="mb-3 text-sm" data-testid="selected-date">{date}</p>
        {saved ? <p className="mb-3 text-sm text-emerald-700" data-testid="save-ok">saved</p> : null}
        <button type="button" className="mb-4 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white" data-testid="open-modal" onClick={() => setOpen(true)}>
          Open modal
        </button>
        <div className="h-24 max-w-full overflow-x-auto rounded-xl bg-amber-100/40 p-3 text-xs text-amber-900" data-testid="wide-block">
          <div className="w-max">Internal scroll ok · page itself must not scroll horizontally</div>
        </div>
        {open ? (
          <Modal
            title="משימה חדשה"
            onClose={() => setOpen(false)}
            footer={
              <div className="flex justify-end gap-2">
                <GhostButton onClick={() => setOpen(false)}>ביטול</GhostButton>
                <PrimaryButton
                  onClick={() => {
                    setSaved(true);
                    setOpen(false);
                  }}
                >
                  שמירת משימה
                </PrimaryButton>
              </div>
            }
          >
            <div className="grid gap-4">
              <Field label="שם המשימה *">
                <input className={inputClass} data-testid="task-title-input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="תאריך">
                <DatePicker value={date} onChange={setDate} />
              </Field>
              <p className="text-sm text-slate-500">Scroll body content for sticky footer check.</p>
              <div className="h-64 rounded-xl bg-slate-50" />
              <div className="h-40 rounded-xl bg-slate-50" />
            </div>
          </Modal>
        ) : null}
      </main>
    </I18nProvider>
  );
}
