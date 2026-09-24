"use client";

import { formatIls } from "@/lib/finance/money";
import type { Task } from "@/types/task";

export function FinanceCell({
  task,
  canSetPrice,
  canPay,
  onSetPrice,
  onPay,
}: {
  task: Task;
  canSetPrice?: boolean;
  canPay?: boolean;
  onSetPrice?: () => void;
  onPay?: () => void;
}) {
  const priced = task.priceIncludingVat !== null;

  if (!priced) {
    if (!canSetPrice) {
      return <span className="text-xs text-slate-400">לא הוגדר מחיר</span>;
    }
    return (
      <button type="button" onClick={onSetPrice} className="text-start text-sm font-medium text-[#2563EB] hover:underline">
        + הגדרת סכום
      </button>
    );
  }

  const unpaid = task.paymentStatus === "UNPAID" || !task.paymentStatus;
  const partial = task.paymentStatus === "PARTIALLY_PAID";

  return (
    <div className="space-y-1 text-start">
      <p className="text-sm font-semibold text-[#0F172A]">{formatIls(task.priceIncludingVat)}</p>
      <button
        type="button"
        onClick={canPay && (task.balanceDue ?? 0) > 0 ? onPay : undefined}
        className="block text-start"
      >
        {unpaid ? (
          <span className="text-xs font-medium text-rose-600">● לא שולם</span>
        ) : partial ? (
          <span className="text-xs font-medium text-amber-600">● יתרה {formatIls(task.balanceDue)}</span>
        ) : (
          <span className="text-xs font-medium text-emerald-600">● שולם</span>
        )}
      </button>
    </div>
  );
}
