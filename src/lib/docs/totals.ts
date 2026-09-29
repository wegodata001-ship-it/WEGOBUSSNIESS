import { money } from "@/lib/finance/money";
import { normalizeVatRate } from "@/lib/finance/vat";
import type { BusinessDocLine, BusinessDocTotals, DocPriceMode } from "@/types/business-doc";

export function lineAmount(line: { qty: number; unitPrice: number; priceMode: DocPriceMode }) {
  if (line.priceMode !== "UNIT") return 0;
  return money((Number(line.qty) || 0) * (Number(line.unitPrice) || 0));
}

export function calculateDocumentTotals(input: {
  lines: Array<{ qty: number; unitPrice: number; priceMode: DocPriceMode }>;
  discount: number;
  discountType: "AMOUNT" | "PERCENT";
  vatRate: number;
  vatInclusive: boolean;
}): BusinessDocTotals {
  const subtotal = money(input.lines.reduce((sum, line) => sum + lineAmount(line), 0));
  const rawDiscount = Number(input.discount) || 0;
  const discount = input.discountType === "PERCENT"
    ? money(subtotal * Math.min(100, Math.max(0, rawDiscount)) / 100)
    : money(Math.min(Math.max(0, rawDiscount), subtotal));
  const afterDiscount = money(Math.max(0, subtotal - discount));
  const vatRate = normalizeVatRate(input.vatRate);
  if (input.vatInclusive) {
    const total = afterDiscount;
    const beforeVat = money(total / (1 + vatRate));
    const vat = money(total - beforeVat);
    return { subtotal, discount, beforeVat, vat, total, vatRate };
  }
  const beforeVat = afterDiscount;
  const vat = money(beforeVat * vatRate);
  return { subtotal, discount, beforeVat, vat, total: money(beforeVat + vat), vatRate };
}

export function emptyLine(): BusinessDocLine {
  return {
    id: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    taskId: null,
    title: "",
    description: "",
    note: "",
    qty: 1,
    unitPrice: 0,
    priceMode: "UNIT",
  };
}
