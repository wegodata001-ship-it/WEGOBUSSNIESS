const DATE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "startedAt",
  "endedAt",
  "startAt",
  "endAt",
]);

export function reviveSessionDates<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => reviveSessionDates(item)) as T;
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (DATE_KEYS.has(key) && typeof nested === "string") {
        result[key] = new Date(nested);
      } else {
        result[key] = reviveSessionDates(nested);
      }
    }
    return result as T;
  }

  return value;
}
