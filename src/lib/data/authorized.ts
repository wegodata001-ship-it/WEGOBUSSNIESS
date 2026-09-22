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
    return readyResult(empty);
  }

  const payload = reviveSessionDates(await response.json()) as { data?: T };
  return readyResult(payload.data ?? empty);
}
