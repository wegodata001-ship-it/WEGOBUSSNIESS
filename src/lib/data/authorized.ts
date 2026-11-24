import { readyResult, type DataResult } from "@/lib/data/result";
import { reviveSessionDates } from "@/lib/session/serialize";

export async function fetchBusinessRecords<T>(
  businessId: string | null,
  kind: string,
  empty: T,
  options?: { includeDeleted?: boolean; deletedOnly?: boolean },
): Promise<DataResult<T>> {
  if (!businessId) {
    return readyResult(empty);
  }

  const params = new URLSearchParams({
    businessId,
    kind,
  });
  if (options?.includeDeleted) params.set("includeDeleted", "1");
  if (options?.deletedOnly) params.set("deletedOnly", "1");

  const response = await fetch(
    `/api/business/records?${params.toString()}`,
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
