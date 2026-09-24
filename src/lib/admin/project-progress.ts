export function normalizeProjectProgress(value: unknown): number {
  if (value == null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}
