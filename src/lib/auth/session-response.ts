import { NextResponse } from "next/server";
import { applySessionCookies } from "@/lib/auth/session-cookies";
import type { ResolveResult, SessionBlockReason } from "@/types/session";

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "BUSINESS_ACCESS_DENIED"
  | "AUTH_CONFIGURATION_ERROR"
  | "AUTH_INTERNAL_ERROR"
  | "AUTH_REQUIRED";

const BLOCK_STATUS: Record<SessionBlockReason, number> = {
  invalid_credentials: 401,
  too_many_requests: 429,
  inactive_user: 403,
  inactive_membership: 403,
  no_membership: 403,
  no_business: 403,
  unconfigured: 503,
  internal: 503,
};

const BLOCK_CODE: Record<SessionBlockReason, AuthErrorCode> = {
  invalid_credentials: "INVALID_CREDENTIALS",
  too_many_requests: "INVALID_CREDENTIALS",
  inactive_user: "BUSINESS_ACCESS_DENIED",
  inactive_membership: "BUSINESS_ACCESS_DENIED",
  no_membership: "BUSINESS_ACCESS_DENIED",
  no_business: "BUSINESS_ACCESS_DENIED",
  unconfigured: "AUTH_CONFIGURATION_ERROR",
  internal: "AUTH_INTERNAL_ERROR",
};

export function blockedSession(reason: SessionBlockReason, status?: number) {
  const http = status ?? BLOCK_STATUS[reason];
  return NextResponse.json(
    { ok: false, status: "blocked", reason, code: BLOCK_CODE[reason] } satisfies ResolveResult & { ok: false; code: AuthErrorCode },
    { status: http },
  );
}

export function readySession(result: Extract<ResolveResult, { status: "ready" }>, tokens?: { idToken: string; refreshToken?: string }) {
  const response = NextResponse.json({ ok: true, ...result });
  if (tokens?.idToken) {
    applySessionCookies(response, tokens.idToken, tokens.refreshToken);
  }
  return response;
}

export function unauthenticatedSession() {
  return NextResponse.json(
    { ok: false, status: "unauthenticated", code: "AUTH_REQUIRED" as const },
    { status: 401 },
  );
}

export function logAuthStage(scope: "AUTH_LOGIN" | "AUTH_RESOLVE", stage: string, extra?: string) {
  if (extra) {
    console.error(`[${scope}_FAILED]`, stage, extra);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`[${scope}]`, stage);
  }
}
