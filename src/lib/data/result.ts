import { WAITING_FOR_FIREBASE_CONFIG } from "@/lib/env";

export type DataStatus = "READY" | typeof WAITING_FOR_FIREBASE_CONFIG;

export type DataResult<T> = {
  status: DataStatus;
  data: T;
  error?: string | null;
};

export function waitingResult<T>(data: T): DataResult<T> {
  return { status: WAITING_FOR_FIREBASE_CONFIG, data };
}

export function readyResult<T>(data: T): DataResult<T> {
  return { status: "READY", data };
}
