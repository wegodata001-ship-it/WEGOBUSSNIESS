import { NextResponse } from "next/server";
import { writeSessionCookies } from "@/lib/auth/session-cookies";
import { resolveSessionByUid } from "@/lib/session/resolve-admin";
import type { ResolveResult } from "@/types/session";

type PasswordSignIn = {
  idToken?: string;
  refreshToken?: string;
  localId?: string;
  error?: { message?: string };
};

function isInvalidLogin(message: string) {
  return (
    message === "INVALID_PASSWORD"
    || message === "EMAIL_NOT_FOUND"
    || message === "INVALID_LOGIN_CREDENTIALS"
    || message === "INVALID_EMAIL"
    || message === "USER_DISABLED"
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim() ?? "";
  const password = body?.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ status: "blocked", reason: "invalid_credentials" } satisfies ResolveResult, { status: 401 });
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ status: "blocked", reason: "unconfigured" } satisfies ResolveResult, { status: 500 });
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
    if (isInvalidLogin(errorMessage)) {
      return NextResponse.json({ status: "blocked", reason: "invalid_credentials" } satisfies ResolveResult, { status: 401 });
    }
    return NextResponse.json({ status: "blocked", reason: "unconfigured" } satisfies ResolveResult, { status: 401 });
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
    console.error("SESSION_LOGIN_FAILED", message);
    return NextResponse.json({ status: "blocked", reason: "unconfigured" } satisfies ResolveResult, { status: 500 });
  }
}
