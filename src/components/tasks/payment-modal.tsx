"use client";

import { useMemo, useState } from "react";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/admin/ui";
import { allocateByTaskOrder } from "@/lib/finance/allocate";
import { formatIls, money, parseMoney } from "@/lib/finance/money";
import { receiveBusinessPayment } from "@/lib/business/api";
import { PAYMENT_METHODS, type PaymentMethod } from "@/types/payment";
import type { Task } from "@/types/task";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "מזומן",
  CREDIT_CARD: "כרטיס אשראי",
  BANK_TRANSFER: "העברה בנקאית",
  CHECK: "צ'ק",
  OTHER: "אחר",
};

export function PaymentModal({
  tasks,
  businessId,
  defaultDate,
  onClose,
  onSaved,
}: {
  tasks: Task[];
  businessId: string;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
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
      setError(result.error === "FORBIDDEN" ? "אין הרשאה לקבלת תשלום" : "לא ניתן לרשום את התשלום");
      return;
    }
    onSaved();
  }

  return (
    <Modal title="קבלת תשלום" onClose={onClose}>
      {priced.length === 1 ? (
        <div className="mb-4 space-y-1 text-sm">
          <p className="font-medium text-slate-900">{priced[0]?.title}</p>
          <p className="flex justify-between text-slate-600"><span>מחיר לפני מע״מ</span><span>{formatIls(priced[0]?.priceBeforeVat)}</span></p>
          <p className="flex justify-between text-slate-600"><span>מע״מ</span><span>{formatIls(priced[0]?.vatAmount)}</span></p>
          <p className="flex justify-between font-semibold"><span>סה״כ</span><span>{formatIls(priced[0]?.priceIncludingVat)}</span></p>
          <p className="flex justify-between pt-2"><span>שולם עד היום</span><span>{formatIls(priced[0]?.paidAmount)}</span></p>
          <p className="flex justify-between text-amber-700"><span>יתרה</span><span>{formatIls(priced[0]?.balanceDue)}</span></p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">{priced.length} משימות נבחרו</p>
          <div className="space-y-3">
            {priced.map((task) => (
              <div key={task.id} className="rounded-xl border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-900">{task.title}</p>
                <p className="text-xs text-slate-500">{formatIls(task.priceBeforeVat)} לפני מע״מ · {formatIls(task.priceIncludingVat)} כולל מע״מ</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 rounded-xl bg-slate-50 px-3 py-3 text-sm">
            <p className="flex justify-between"><span>סה״כ לפני מע״מ</span><span>{formatIls(subtotal)}</span></p>
            <p className="flex justify-between"><span>מע״מ</span><span>{formatIls(vatTotal)}</span></p>
            <p className="flex justify-between font-semibold"><span>סה״כ לתשלום</span><span>{formatIls(dueTotal)}</span></p>
          </div>
        </>
      )}
      <div className="mt-4 grid gap-3">
        <Field label="סכום שהתקבל">
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="אמצעי תשלום">
          <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod | "")}>
            <option value="">בחר אמצעי תשלום</option>
            {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{METHOD_LABELS[item]}</option>)}
          </select>
        </Field>
        <Field label="תאריך תשלום">
          <input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="אסמכתא">
          <input className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} />
        </Field>
        <Field label="הערה">
          <textarea className={`${inputClass} h-20 py-2`} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 px-3 py-3 text-sm">
        <p className="mb-2 font-medium">חלוקת תשלום</p>
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
          <span>סה״כ מוקצה</span>
          <span>{formatIls(plan.allocated)}</span>
        </p>
        {received < dueTotal ? (
          <p className="mt-1 text-amber-700">יתרה לאחר תשלום זה: {formatIls(money(dueTotal - received))}</p>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onClose}>ביטול</GhostButton>
        <PrimaryButton disabled={busy || received <= 0 || !method || plan.leftover > 0} onClick={() => void submit()}>
          אישור תשלום
        </PrimaryButton>
      </div>
    </Modal>
  );
}
