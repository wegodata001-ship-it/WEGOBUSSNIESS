import { money } from "@/lib/finance/money";
import { PROJECT_BASE_VAT_MODES, type ProjectBaseVatMode } from "@/types/department";

export type { ProjectBaseVatMode };
export { PROJECT_BASE_VAT_MODES };

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

/** Legacy projects without a stored mode keep excluding-VAT behavior. */
export function resolveProjectBaseVatMode(value: unknown): ProjectBaseVatMode {
  return PROJECT_BASE_VAT_MODES.includes(value as ProjectBaseVatMode)
    ? value as ProjectBaseVatMode
    : "EXCLUDING_VAT";
}

/**
 * Project base price from a single entered amount + VAT mode.
 * EXCLUDING_VAT: entered is before VAT → add VAT.
 * INCLUDING_VAT: entered already includes VAT → split before/VAT without adding again.
 */
export function calculateProjectBasePrice(
  enteredAmount: number,
  vatRate: number,
  mode: ProjectBaseVatMode = "EXCLUDING_VAT",
) {
  const entered = money(enteredAmount);
  const rate = normalizeVatRate(vatRate);
  if (mode === "INCLUDING_VAT") {
    const priceIncludingVat = entered;
    const priceBeforeVat = rate > 0 ? money(priceIncludingVat / (1 + rate)) : priceIncludingVat;
    const vatAmount = money(priceIncludingVat - priceBeforeVat);
    return {
      priceBeforeVat,
      vatRate: rate,
      vatAmount,
      priceIncludingVat,
      vatMode: mode,
    };
  }
  const calc = calculateTaskPrice(entered, rate);
  return { ...calc, vatMode: mode };
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
