import { money } from "@/lib/finance/money";

export const DEFAULT_BUSINESS_VAT_RATE = 0.18;

export function normalizeVatRate(value: unknown, fallback = DEFAULT_BUSINESS_VAT_RATE) {
  const parsed = typeof value === "number" ? value : Number(typeof value === "string" ? value : NaN);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  if (parsed > 1) return money(parsed / 100);
  return money(parsed);
}

export function calculateTaskPrice(priceBeforeVat: number, vatRate: number) {
  const before = money(priceBeforeVat);
  const rate = normalizeVatRate(vatRate);
  const vatAmount = money(before * rate);
  return {
    priceBeforeVat: before,
    vatRate: rate,
    vatAmount,
    priceIncludingVat: money(before + vatAmount),
  };
}

export function paymentStatusFor(paidAmount: number, priceIncludingVat: number | null) {
  if (priceIncludingVat === null) return null;
  const paid = money(paidAmount);
  const total = money(priceIncludingVat);
  if (paid <= 0) return "UNPAID" as const;
  if (paid + 0.001 < total) return "PARTIALLY_PAID" as const;
  return "PAID" as const;
}

export function remainingBalance(priceIncludingVat: number | null, paidAmount: number) {
  if (priceIncludingVat === null) return null;
  return money(Math.max(0, priceIncludingVat - paidAmount));
}
