import { NextResponse } from "next/server";
import { writeSessionCookies } from "@/lib/auth/session-cookies";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { resolveSessionByUid } from "@/lib/session/resolve-admin";
import type { ResolveResult, SessionBlockReason } from "@/types/session";

type PasswordSignIn = {
  idToken?: string;
  refreshToken?: string;
  localId?: string;
  error?: { message?: string };
};

function identityReason(message: string): SessionBlockReason | null {
  const code = message.split(":")[0]?.trim() ?? "";
  if (
    code === "INVALID_PASSWORD"
    || code === "EMAIL_NOT_FOUND"
    || code === "INVALID_LOGIN_CREDENTIALS"
    || code === "INVALID_EMAIL"
  ) {
    return "invalid_credentials";
  }
  if (code === "USER_DISABLED") {
    return "inactive_user";
  }
  if (code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
    return "too_many_requests";
  }
  return null;
}

function blocked(reason: SessionBlockReason, status: number) {
  return NextResponse.json({ status: "blocked", reason } satisfies ResolveResult, { status });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim() ?? "";
  const password = body?.password ?? "";
  if (!email || !password) {
    return blocked("invalid_credentials", 401);
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    console.error("SESSION_LOGIN_STAGE", "missing_api_key");
    return blocked("unconfigured", 500);
  }

  if (!isFirebaseAdminConfigured()) {
    console.error("SESSION_LOGIN_STAGE", "admin_unconfigured");
    return blocked("unconfigured", 500);
  }

  const tokenResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const tokens = (await tokenResponse.json()) as PasswordSignIn;
  const errorMessage = tokens.error?.message ?? "";

  if (!tokens.idToken || !tokens.localId) {
    const reason = identityReason(errorMessage);
    if (reason) {
      return blocked(reason, 401);
    }
    console.error("SESSION_LOGIN_STAGE", "identity_toolkit", errorMessage.split(":")[0] || "unknown");
    return blocked("unconfigured", 401);
  }

  try {
    const resolved = await resolveSessionByUid(tokens.localId);
    if (resolved.status === "blocked") {
      return NextResponse.json(resolved);
    }

    await writeSessionCookies(tokens.idToken, tokens.refreshToken);
    return NextResponse.json(resolved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("SESSION_LOGIN_STAGE", "session_finalize", message);
    return blocked("unconfigured", 500);
  }
}
