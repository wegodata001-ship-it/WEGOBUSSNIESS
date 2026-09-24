import type { TaskPaymentStatus } from "@/types/payment";

const LABELS: Record<TaskPaymentStatus, string> = {
  UNPAID: "לא שולם",
  PARTIALLY_PAID: "שולם חלקית",
  PAID: "שולם",
};

const TONE: Record<TaskPaymentStatus, string> = {
  UNPAID: "bg-rose-50 text-rose-700",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
};

export function paymentStatusLabel(status: TaskPaymentStatus | null) {
  return status ? LABELS[status] : "לא הוגדר מחיר";
}

export function PaymentStatusBadge({ status }: { status: TaskPaymentStatus | null }) {
  if (!status) {
    return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">לא הוגדר מחיר</span>;
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TONE[status]}`}>{LABELS[status]}</span>;
}
