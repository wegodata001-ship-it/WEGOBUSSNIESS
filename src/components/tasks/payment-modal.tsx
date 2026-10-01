"use client";

import { useMemo, useState } from "react";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { allocateByTaskOrder } from "@/lib/finance/allocate";
import { formatIls, money, parseMoney } from "@/lib/finance/money";
import { receiveBusinessPayment } from "@/lib/business/api";
import { labelOf } from "@/lib/admin/labels";
import { PAYMENT_METHODS, type PaymentMethod } from "@/types/payment";
import type { Project } from "@/types/department";
import type { Task } from "@/types/task";

export function PaymentModal({
  tasks,
  businessId,
  defaultDate,
  projects = [],
  clientName,
  onClose,
  onSaved,
}: {
  tasks: Task[];
  businessId: string;
  defaultDate: string;
  projects?: Project[];
  clientName?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const project = projects.find((item) => item.id === tasks[0]?.projectId);
  const priced = tasks.filter((task) => task.priceIncludingVat !== null && (task.balanceDue ?? 0) > 0);
  const subtotal = money(priced.reduce((sum, task) => sum + (task.priceBeforeVat ?? 0), 0));
  const vatTotal = money(priced.reduce((sum, task) => sum + (task.vatAmount ?? 0), 0));
  const dueTotal = money(priced.reduce((sum, task) => sum + (task.balanceDue ?? 0), 0));
  const [amount, setAmount] = useState(String(dueTotal));
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [date, setDate] = useState(defaultDate);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const received = parseMoney(amount) ?? 0;
  const plan = useMemo(
    () => allocateByTaskOrder(priced.map((task) => ({ id: task.id, balanceDue: task.balanceDue ?? 0 })), received),
    [priced, received],
  );

  async function submit() {
    if (!priced.length || received <= 0 || !method) return;
    setBusy(true);
    setError(null);
    const result = await receiveBusinessPayment({
      businessId,
      taskIds: priced.map((task) => task.id),
      amount: received,
      paymentMethod: method,
      paymentDate: date,
      reference,
      notes,
      allocations: plan.allocations.filter((item) => item.amount > 0),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "FORBIDDEN" ? t("pay.forbidden") : t("pay.failed"));
      return;
    }
    onSaved();
  }

  return (
    <Modal title={t("work.receivePayment")} onClose={onClose}>
      {clientName || project?.clientName || project?.name ? (
        <div className="mb-4 space-y-1 text-sm text-slate-600">
          {clientName || project?.clientName ? <p>{t("common.client")}: <span className="font-medium text-slate-900">{clientName || project?.clientName}</span></p> : null}
          {project?.name ? <p>{t("common.project")}: <span className="font-medium text-slate-900">{project.name}</span></p> : null}
        </div>
      ) : null}
      {priced.length === 1 ? (
        <div className="mb-4 space-y-1 text-sm">
          <p className="font-medium text-slate-900">{priced[0]?.title}</p>
          <p className="flex justify-between text-slate-600"><span>{t("work.priceBeforeVat")}</span><span>{formatIls(priced[0]?.priceBeforeVat)}</span></p>
          <p className="flex justify-between text-slate-600"><span>{t("work.vat")}</span><span>{formatIls(priced[0]?.vatAmount)}</span></p>
          <p className="flex justify-between font-semibold"><span>{t("pay.total")}</span><span>{formatIls(priced[0]?.priceIncludingVat)}</span></p>
          <p className="flex justify-between pt-2"><span>{t("pay.paidToDate")}</span><span>{formatIls(priced[0]?.paidAmount)}</span></p>
          <p className="flex justify-between text-amber-700"><span>{t("work.balance")}</span><span>{formatIls(priced[0]?.balanceDue)}</span></p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">{t("work.selectedCount", { count: String(priced.length) })}</p>
          <div className="space-y-3">
            {priced.map((task) => (
              <div key={task.id} className="rounded-xl border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-900">{task.title}</p>
                <p className="text-xs text-slate-500">{formatIls(task.priceBeforeVat)} {t("work.priceBeforeVat")} · {formatIls(task.priceIncludingVat)} {t("pay.inclVat")}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 rounded-xl bg-slate-50 px-3 py-3 text-sm">
            <p className="flex justify-between"><span>{t("pay.totalBeforeVat")}</span><span>{formatIls(subtotal)}</span></p>
            <p className="flex justify-between"><span>{t("work.vat")}</span><span>{formatIls(vatTotal)}</span></p>
            <p className="flex justify-between font-semibold"><span>{t("pay.totalDue")}</span><span>{formatIls(dueTotal)}</span></p>
          </div>
        </>
      )}
      <div className="mt-4 grid gap-3">
        <Field label={t("pay.received")}>
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label={t("pay.method")}>
          <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod | "")}>
            <option value="">{t("pay.pickMethod")}</option>
            {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item === "OTHER" ? t("common.other") : labelOf(item)}</option>)}
          </select>
        </Field>
        <Field label={t("pay.date")}>
          <input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label={t("pay.reference")}>
          <input className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} />
        </Field>
        <Field label={t("common.note")}>
          <textarea className={`${inputClass} h-20 py-2`} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 px-3 py-3 text-sm">
        <p className="mb-2 font-medium">{t("pay.split")}</p>
        {priced.map((task) => {
          const row = plan.allocations.find((item) => item.taskId === task.id);
          return (
            <p key={task.id} className="flex justify-between py-0.5">
              <span>{task.title}</span>
              <span>{formatIls(row?.amount ?? 0)}</span>
            </p>
          );
        })}
        <p className="mt-2 flex justify-between font-semibold">
          <span>{t("pay.allocated")}</span>
          <span>{formatIls(plan.allocated)}</span>
        </p>
        {received < dueTotal ? (
          <p className="mt-1 text-amber-700">{t("pay.balanceAfter", { amount: formatIls(money(dueTotal - received)) })}</p>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
        <PrimaryButton disabled={busy || received <= 0 || !method || plan.leftover > 0} onClick={() => void submit()}>
          {t("pay.confirm")}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
