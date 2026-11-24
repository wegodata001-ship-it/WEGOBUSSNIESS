"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Field, GhostButton, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { fetchProjectPayments, receiveBusinessPayment, saveProjectBasePrice, voidBusinessPayment } from "@/lib/business/api";
import { computeProjectFinance } from "@/lib/finance/project-ledger";
import { formatIls } from "@/lib/finance/money";
import { type ProjectBaseVatMode, resolveProjectBaseVatMode } from "@/lib/finance/vat";
import { todayInTimeZone } from "@/lib/dates/format";
import { labelOf } from "@/lib/admin/labels";
import type { Project } from "@/types/department";
import type { PaymentRecord } from "@/types/payment";
import type { Task } from "@/types/task";
import { PAYMENT_METHODS } from "@/types/payment";

function baseDraftFromProject(project: Project) {
  const mode = resolveProjectBaseVatMode(project.basePriceVatMode);
  if (mode === "INCLUDING_VAT") {
    return project.basePriceIncludingVat != null ? String(project.basePriceIncludingVat) : "";
  }
  return project.basePriceBeforeVat != null ? String(project.basePriceBeforeVat) : "";
}

type Props = {
  businessId: string;
  project: Project;
  tasks: Task[];
  canView: boolean;
  canSetPrice: boolean;
  canReceive: boolean;
  canVoid: boolean;
  timezone?: string;
  onChanged: () => void;
};

export function ProjectFinancePanel({
  businessId,
  project,
  tasks,
  canView,
  canSetPrice,
  canReceive,
  canVoid,
  timezone,
  onChanged,
}: Props) {
  const { t } = useI18n();
  const ledger = useMemo(() => computeProjectFinance(project, tasks), [project, tasks]);
  const billableTasks = useMemo(
    () => tasks.filter((task) => task.billingMode === "BILLABLE" && task.priceIncludingVat !== null),
    [tasks],
  );
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [baseDraft, setBaseDraft] = useState(() => baseDraftFromProject(project));
  const [vatMode, setVatMode] = useState<ProjectBaseVatMode>(() => resolveProjectBaseVatMode(project.basePriceVatMode));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("BANK_TRANSFER");
  const [date, setDate] = useState(todayInTimeZone(timezone));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPayments = useCallback(async () => {
    const result = await fetchProjectPayments(businessId, project.id);
    if (result.ok) setPayments(result.data as PaymentRecord[]);
  }, [businessId, project.id]);

  useEffect(() => {
    setBaseDraft(baseDraftFromProject(project));
    setVatMode(resolveProjectBaseVatMode(project.basePriceVatMode));
    // Sync only when persisted finance fields change (avoid wiping while typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project.id,
    project.basePriceBeforeVat,
    project.basePriceIncludingVat,
    project.basePriceVatMode,
  ]);

  useEffect(() => {
    if (canView) void loadPayments();
  }, [canView, loadPayments]);

  if (!canView) {
    return <p className="text-sm text-slate-500">{t("finance.hidden")}</p>;
  }

  async function saveBase() {
    if (!canSetPrice) return;
    setBusy(true);
    setError("");
    setMessage("");
    const result = await saveProjectBasePrice({
      businessId,
      projectId: project.id,
      priceBeforeVat: Number(baseDraft || 0),
      vatMode,
    });
    setBusy(false);
    if (!result.ok) {
      setError(t("finance.saveFailed"));
      return;
    }
    setMessage(t("finance.baseSaved"));
    onChanged();
  }

  async function addPayment() {
    if (!canReceive) return;
    setBusy(true);
    setError("");
    setMessage("");
    const result = await receiveBusinessPayment({
      businessId,
      projectId: project.id,
      taskIds: billableTasks.map((task) => task.id),
      amount: Number(amount),
      paymentMethod: method,
      paymentDate: date,
      notes,
      allowOverpay: true,
    });
    setBusy(false);
    if (!result.ok) {
      setError(t("finance.paymentFailed"));
      return;
    }
    setAmount("");
    setNotes("");
    setMessage(t("finance.paymentSaved"));
    await loadPayments();
    onChanged();
  }

  async function voidPayment(paymentId: string) {
    if (!canVoid) return;
    if (typeof window !== "undefined" && !window.confirm(t("finance.voidConfirm"))) return;
    setBusy(true);
    setError("");
    const result = await voidBusinessPayment({ businessId, paymentId });
    setBusy(false);
    if (!result.ok) {
      setError(t("finance.voidFailed"));
      return;
    }
    setMessage(t("finance.voided"));
    await loadPayments();
    onChanged();
  }

  const statusLabel = ledger.paymentStatus === "CREDIT"
    ? t("finance.statusCredit")
    : ledger.paymentStatus === "PAID"
      ? t("finance.statusPaid")
      : ledger.paymentStatus === "PARTIALLY_PAID"
        ? t("finance.statusPartial")
        : t("finance.statusUnpaid");

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">{t("finance.modesHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("finance.basePrice")}</p>
          <p className="mt-1 text-lg font-semibold">{formatIls(ledger.basePrice, "0.00 ₪")}</p>
          {project.basePriceIncludingVat != null ? (
            <p className="mt-1 text-xs text-slate-500">
              {t("finance.beforeVat")}: {formatIls(project.basePriceBeforeVat)} · {t("finance.vatAmount")}: {formatIls(project.baseVatAmount)} · {t("finance.inclVatShort")}: {formatIls(project.basePriceIncludingVat)}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("finance.extras")}</p>
          <p className="mt-1 text-lg font-semibold">{formatIls(ledger.extrasTotal, "0.00 ₪")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("finance.totalDue")}</p>
          <p className="mt-1 text-lg font-semibold">{formatIls(ledger.totalDue, "0.00 ₪")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("finance.paid")}</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">{formatIls(ledger.paid, "0.00 ₪")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("finance.balance")}</p>
          <p className="mt-1 text-lg font-semibold text-amber-700">{formatIls(ledger.balanceDue, "0.00 ₪")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("finance.status")}</p>
          <p className="mt-1 text-lg font-semibold">{statusLabel}</p>
          {ledger.credit > 0 ? (
            <p className="mt-1 text-sm text-sky-700">{t("finance.credit")}: {formatIls(ledger.credit)}</p>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-slate-500">{t("finance.vatNote")}</p>

      {canSetPrice ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <Field label={t("finance.editBasePrice")}>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <input
                className={`${inputClass} w-full sm:max-w-[12rem]`}
                inputMode="decimal"
                value={baseDraft}
                onChange={(e) => setBaseDraft(e.target.value)}
                placeholder="0"
              />
              <PrimaryButton disabled={busy} onClick={() => void saveBase()}>{t("finance.saveBase")}</PrimaryButton>
            </div>
          </Field>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <label className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1">
              <input
                type="radio"
                name="project-base-vat-mode"
                checked={vatMode === "INCLUDING_VAT"}
                onChange={() => setVatMode("INCLUDING_VAT")}
              />
              {t("finance.vatModeIncluding")}
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1">
              <input
                type="radio"
                name="project-base-vat-mode"
                checked={vatMode === "EXCLUDING_VAT"}
                onChange={() => setVatMode("EXCLUDING_VAT")}
              />
              {t("finance.vatModeExcluding")}
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">{t("finance.baseHint")}</p>
          {project.basePriceIncludingVat != null ? (
            <div className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-3">
              <p>{t("finance.beforeVat")}: <span className="font-medium">{formatIls(project.basePriceBeforeVat)}</span></p>
              <p>{t("finance.vatAmount")}: <span className="font-medium">{formatIls(project.baseVatAmount)}</span></p>
              <p>{t("finance.inclVatShort")}: <span className="font-medium">{formatIls(project.basePriceIncludingVat)}</span></p>
            </div>
          ) : null}
        </div>
      ) : null}

      {billableTasks.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-800">{t("finance.billableTasks")}</p>
          <ul className="space-y-2 text-sm">
            {billableTasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                <span>{task.title}</span>
                <span className="text-slate-600">
                  {formatIls(task.priceIncludingVat)} · {formatIls(task.paidAmount, "0.00 ₪")} {t("finance.paidShort")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t("finance.noBillableTasks")}</p>
      )}

      {canReceive ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-slate-800">{t("finance.addPayment")}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("pay.received")}>
              <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label={t("pay.date")}>
              <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t("pay.method")}>
              <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((item) => (
                  <option key={item} value={item}>{labelOf(item)}</option>
                ))}
              </select>
            </Field>
            <Field label={t("pay.reference")}>
              <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3">
            <PrimaryButton disabled={busy || !amount.trim()} onClick={() => void addPayment()}>
              {t("finance.recordPayment")}
            </PrimaryButton>
          </div>
          <p className="mt-2 text-xs text-slate-500">{t("finance.paymentAllocHint")}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-slate-800">{t("finance.paymentHistory")}</p>
        {payments.length ? (
          <ul className="space-y-2 text-sm">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                <div>
                  <p className="font-medium">{formatIls(payment.amount)} · {payment.paymentDate}</p>
                  <p className="text-xs text-slate-500">
                    {labelOf(payment.paymentMethod)}
                    {payment.notes ? ` · ${payment.notes}` : ""}
                    {payment.status === "VOIDED" ? ` · ${t("finance.voided")}` : ""}
                  </p>
                </div>
                {canVoid && payment.status === "RECORDED" ? (
                  <GhostButton disabled={busy} onClick={() => void voidPayment(payment.id)}>
                    {t("finance.voidPayment")}
                  </GhostButton>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t("finance.noPayments")}</p>
        )}
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
