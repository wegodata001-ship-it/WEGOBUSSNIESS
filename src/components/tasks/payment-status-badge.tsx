"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import { getI18nLocale, translate } from "@/lib/i18n";
import { labelOf } from "@/lib/admin/labels";
import type { TaskPaymentStatus } from "@/types/payment";

const TONE: Record<TaskPaymentStatus, string> = {
  UNPAID: "bg-rose-50 text-rose-700",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
};

export function paymentStatusLabel(status: TaskPaymentStatus | null) {
  if (!status) return translate(getI18nLocale(), "work.noPrice");
  return labelOf(status);
}

export function PaymentStatusBadge({ status }: { status: TaskPaymentStatus | null }) {
  const { t } = useI18n();
  if (!status) {
    return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{t("work.noPrice")}</span>;
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TONE[status]}`}>{labelOf(status)}</span>;
}
