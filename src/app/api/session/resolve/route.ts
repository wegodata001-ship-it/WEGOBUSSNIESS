import { NextResponse } from "next/server";
import { readRefreshToken, readRequestToken } from "@/lib/auth/request-token";
import { blockedSession, logAuthStage, readySession, unauthenticatedSession } from "@/lib/auth/session-response";
import { resolveSessionByUid, verifyOrRefreshUid } from "@/lib/session/resolve-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = readRequestToken(request);
  if (!token) {
    return unauthenticatedSession();
  }

  try {
    const verified = await verifyOrRefreshUid(token, readRefreshToken(request));
    if (!verified) {
      return unauthenticatedSession();
    }

    const resolved = await resolveSessionByUid(verified.uid);
    if (resolved.status === "blocked") {
      return blockedSession(resolved.reason);
    }

    if (verified.idToken) {
      return readySession(resolved, { idToken: verified.idToken, refreshToken: verified.refreshToken });
    }
    return NextResponse.json({ ok: true, ...resolved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logAuthStage("AUTH_RESOLVE", "session_resolve", message);
    return unauthenticatedSession();
  }
}
