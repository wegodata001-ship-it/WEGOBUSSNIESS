export function normalizeProjectProgress(value: unknown): number {
  if (value == null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function isCompletedTaskStatus(status: string | null | undefined) {
  return status === "COMPLETED" || status === "DONE";
}

export function computeProjectProgress(tasks: Array<{ status?: string | null }>) {
  if (!tasks.length) return 0;
  const done = tasks.filter((task) => isCompletedTaskStatus(task.status)).length;
  return normalizeProjectProgress((done / tasks.length) * 100);
}
