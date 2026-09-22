import { reviveSessionDates } from "@/lib/session/serialize";
import type { ResolveResult } from "@/types/session";

export type { ResolveResult };

export async function resolveUserSession(): Promise<ResolveResult> {
  const response = await fetch("/api/session/resolve", {
    credentials: "include",
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = reviveSessionDates(await response.json());
  } catch {
    return { status: "blocked", reason: "unconfigured" };
  }

  const result = payload as ResolveResult | { status?: string };
  if (result.status === "ready" || result.status === "blocked") {
    return result as ResolveResult;
  }

  return { status: "blocked", reason: response.status === 401 ? "no_membership" : "unconfigured" };
}

export async function loginWithPassword(email: string, password: string): Promise<ResolveResult> {
  const response = await fetch("/api/session/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  let payload: unknown = null;
  try {
    payload = reviveSessionDates(await response.json());
  } catch {
    return { status: "blocked", reason: "unconfigured" };
  }

  const result = payload as ResolveResult & { reason?: string };
  if (result.status === "ready") {
    return result;
  }
  if (result.reason === "invalid_credentials") {
    return { status: "blocked", reason: "invalid_credentials" };
  }
  if (result.status === "blocked") {
    return result;
  }

  return { status: "blocked", reason: "unconfigured" };
}
