"use client";

import { useMemo, useState } from "react";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/admin/ui";
import { saveTaskPrice } from "@/lib/business/api";
import { formatIls, parseMoney } from "@/lib/finance/money";
import { calculateTaskPrice } from "@/lib/finance/vat";
import type { Task } from "@/types/task";

export function PriceModal({
  tasks,
  businessId,
  vatRate,
  onClose,
  onSaved,
}: {
  tasks: Task[];
  businessId: string;
  vatRate: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const first = tasks[0];
  const [amount, setAmount] = useState(first?.priceBeforeVat != null ? String(first.priceBeforeVat) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => {
    const parsed = parseMoney(amount);
    return parsed === null ? null : calculateTaskPrice(parsed, first?.vatRate ?? vatRate);
  }, [amount, first?.vatRate, vatRate]);

  async function save() {
    const parsed = parseMoney(amount);
    if (parsed === null || parsed < 0 || !tasks.length) return;
    setBusy(true);
    setError(null);
    for (const task of tasks) {
      const result = await saveTaskPrice({ businessId, taskId: task.id, priceBeforeVat: parsed });
      if (!result.ok) {
        setBusy(false);
        setError(result.error === "FORBIDDEN" ? "אין הרשאה להגדיר מחיר" : "לא ניתן לשמור את הסכום");
        return;
      }
    }
    setBusy(false);
    onSaved();
  }

  return (
    <Modal title="הגדרת סכום למשימה" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">
        {tasks.length === 1 ? first?.title : `${tasks.length} משימות נבחרו`}
      </p>
      <Field label="מחיר לפני מע״מ">
        <div className="relative">
          <input className={`${inputClass} pe-10`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-slate-500">₪</span>
        </div>
      </Field>
      {preview ? (
        <div className="mt-4 space-y-1 text-sm">
          <p className="flex justify-between text-slate-600">
            <span>מע״מ {Math.round(preview.vatRate * 100)}%</span>
            <span>{formatIls(preview.vatAmount)}</span>
          </p>
          <p className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <span>סה״כ כולל מע״מ</span>
            <span>{formatIls(preview.priceIncludingVat)}</span>
          </p>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onClose}>ביטול</GhostButton>
        <PrimaryButton disabled={busy || !preview} onClick={() => void save()}>שמירה</PrimaryButton>
      </div>
    </Modal>
  );
}
