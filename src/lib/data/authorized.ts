import { readyResult, type DataResult } from "@/lib/data/result";
import { reviveSessionDates } from "@/lib/session/serialize";

export async function fetchBusinessRecords<T>(
  businessId: string | null,
  kind: string,
  empty: T,
): Promise<DataResult<T>> {
  if (!businessId) {
    return readyResult(empty);
  }

  const response = await fetch(
    `/api/business/records?businessId=${encodeURIComponent(businessId)}&kind=${encodeURIComponent(kind)}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return { status: "READY", data: empty, error: payload.error || "LOAD_FAILED" };
  }

  const payload = reviveSessionDates(await response.json()) as { data?: T };
  return readyResult(payload.data ?? empty);
}
