export function money(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return money(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? money(parsed) : null;
  }
  return null;
}

export function formatIls(value: number | null | undefined, empty = "לא הוגדר מחיר") {
  if (value === null || value === undefined || !Number.isFinite(value)) return empty;
  return `${value.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₪`;
}
