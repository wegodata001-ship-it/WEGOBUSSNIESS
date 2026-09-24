export function toTimestamp(value: unknown): number {
  if (value == null) return 0;

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    if (/^\d+(\.\d+)?$/.test(trimmed)) return toTimestamp(Number(trimmed));
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === "object") {
    const record = value as {
      toDate?: () => unknown;
      seconds?: unknown;
      nanoseconds?: unknown;
      _seconds?: unknown;
      _nanoseconds?: unknown;
      $date?: unknown;
    };

    if (typeof record.toDate === "function") {
      try {
        return toTimestamp(record.toDate());
      } catch {
        return 0;
      }
    }

    const seconds = typeof record.seconds === "number"
      ? record.seconds
      : typeof record._seconds === "number"
        ? record._seconds
        : null;
    if (seconds !== null) {
      const nanos = typeof record.nanoseconds === "number"
        ? record.nanoseconds
        : typeof record._nanoseconds === "number"
          ? record._nanoseconds
          : 0;
      return Math.round(seconds * 1000 + nanos / 1e6);
    }

    if (record.$date !== undefined) return toTimestamp(record.$date);
  }

  return 0;
}

export function toSafeDate(value: unknown): Date | null {
  const time = toTimestamp(value);
  return time > 0 ? new Date(time) : null;
}
