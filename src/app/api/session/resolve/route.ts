import { NextResponse } from "next/server";
import { readRefreshToken, readRequestToken } from "@/lib/auth/request-token";
import { writeSessionCookies } from "@/lib/auth/session-cookies";
import { resolveSessionByUid, verifyOrRefreshUid } from "@/lib/session/resolve-admin";
import type { ResolveResult } from "@/types/session";

export async function GET(request: Request) {
  const token = readRequestToken(request);
  if (!token) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401 });
  }

  try {
    const verified = await verifyOrRefreshUid(token, readRefreshToken(request));
    if (!verified) {
      return NextResponse.json({ status: "unauthenticated" }, { status: 401 });
    }

    if (verified.idToken) {
      await writeSessionCookies(verified.idToken, verified.refreshToken);
    }

    return NextResponse.json(await resolveSessionByUid(verified.uid));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("SESSION_RESOLVE_FAILED", message);
    return NextResponse.json({ status: "blocked", reason: "unconfigured" } satisfies ResolveResult, { status: 401 });
  }
}
