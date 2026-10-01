"use client";

import { useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { projectName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { movementsMonthSummary, pricedTaskFinance, recordedMovements } from "@/lib/finance/summary";
import { formatIls } from "@/lib/finance/money";
import { todayInTimeZone } from "@/lib/dates/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/types/payment";
import type { MovementType } from "@/types/movement";

export function MovementsView() {
  const { t } = useI18n();
  const { business, permissions, membership } = useBusinessContext();
  const canView = permissions.includes("finance.view") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canManage = permissions.includes("finance.receivePayment") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const month = today.slice(0, 7);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    type: "INCOME" as MovementType,
    amount: "",
    date: today,
    clientId: "",
    projectId: "",
    description: "",
    paymentMethod: "" as PaymentMethod | "",
    note: "",
  });

  const monthSummary = useMemo(() => movementsMonthSummary(data.movements, month), [data.movements, month]);
  const pending = useMemo(() => pricedTaskFinance(data.tasks).open, [data.tasks]);
  const rows = useMemo(
    () => recordedMovements(data.movements).slice().sort((left, right) => right.date.localeCompare(left.date)),
    [data.movements],
  );

  if (loading) return <Spinner label={t("common.loading")} />;
  if (!canView) return <EmptyState icon={Coins} title={t("empty.noAccess")} />;

  async function save() {
    if (!business?.id) return;
    setBusy(true);
    setError("");
    const client = data.clients.find((item) => item.id === draft.clientId);
    const response = await fetch("/api/business/movements", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: business.id,
        type: draft.type,
        amount: draft.amount,
        date: draft.date,
        clientId: draft.clientId || null,
        clientName: client?.name || "",
        projectId: draft.projectId || null,
        description: draft.description,
        paymentMethod: draft.paymentMethod || null,
        note: draft.note,
      }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok || payload.error) {
      setError(payload.error === "FORBIDDEN" ? t("pay.forbidden") : t("pay.failed"));
      return;
    }
    setOpen(false);
    await reload({ silent: true });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("move.title")}
        subtitle={t("move.subtitle")}
        actions={canManage ? <PrimaryButton onClick={() => setOpen(true)}>{t("move.new")}</PrimaryButton> : null}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={`${t("move.thisMonth")} · ${t("move.income")}`} value={formatIls(monthSummary.income)} />
        <Kpi label={t("move.expense")} value={formatIls(monthSummary.expense)} />
        <Kpi label={t("move.pending")} value={formatIls(pending)} />
        <Kpi label={t("move.net")} value={formatIls(monthSummary.net)} />
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50 text-start text-xs text-slate-500">
              <tr>
                {[t("common.date"), t("common.client"), t("common.project"), t("move.for"), t("move.amount"), t("move.kind"), t("common.status")].map((item) => (
                  <th key={item} className="px-3 py-3 font-medium">{item}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{item.date}</td>
                  <td className="px-3 py-3">{item.clientName || "—"}</td>
                  <td className="px-3 py-3">{projectName(data.projects, item.projectId)}</td>
                  <td className="px-3 py-3">{item.description || "—"}</td>
                  <td className="px-3 py-3">{formatIls(item.amount)}</td>
                  <td className="px-3 py-3">{item.type === "INCOME" ? t("move.income") : t("move.expense")}</td>
                  <td className="px-3 py-3">{item.type === "INCOME" ? t("move.received") : t("move.paid")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Coins} title={t("move.empty")} />
      )}

      {open ? (
        <Modal title={t("move.new")} onClose={() => setOpen(false)}>
          <div className="grid gap-3">
            <div className="flex gap-2">
              {(["INCOME", "EXPENSE"] as MovementType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDraft({ ...draft, type })}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm ${draft.type === type ? "bg-[#0F172A] text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {type === "INCOME" ? t("move.income") : t("move.expense")}
                </button>
              ))}
            </div>
            <Field label={t("move.amount")}>
              <input className={inputClass} inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
            </Field>
            <Field label={t("common.date")}>
              <input className={inputClass} type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
            </Field>
            <Field label={t("common.client")}>
              <select className={inputClass} value={draft.clientId} onChange={(event) => setDraft({ ...draft, clientId: event.target.value })}>
                <option value="">—</option>
                {data.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label={t("common.project")}>
              <select className={inputClass} value={draft.projectId} onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}>
                <option value="">—</option>
                {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label={t("move.for")}>
              <input className={inputClass} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </Field>
            <Field label={t("pay.method")}>
              <select className={inputClass} value={draft.paymentMethod} onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value as PaymentMethod | "" })}>
                <option value="">—</option>
                {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item === "OTHER" ? t("common.other") : labelOf(item)}</option>)}
              </select>
            </Field>
            <Field label={t("common.note")}>
              <textarea className={`${inputClass} h-20 py-2`} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
            </Field>
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <GhostButton onClick={() => setOpen(false)}>{t("common.cancel")}</GhostButton>
            <PrimaryButton disabled={busy || !draft.amount} onClick={() => void save()}>{t("move.save")}</PrimaryButton>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
