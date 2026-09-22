import { getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { waitingResult, type DataResult } from "@/lib/data/result";

export function withClientDb<T>(
  empty: T,
  read: (db: ReturnType<typeof getFirebaseDb>) => Promise<T>,
): Promise<DataResult<T>> {
  if (!isFirebaseClientConfigured()) {
    return Promise.resolve(waitingResult(empty));
  }

  return read(getFirebaseDb()).then((data) => ({ status: "READY" as const, data }));
}
