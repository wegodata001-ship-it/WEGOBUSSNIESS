import { NextResponse } from "next/server";
import { isValidResetEmail, requestPasswordReset } from "@/lib/auth/password-reset";
import { getFirebaseWebApiKey } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void process.env.FIREBASE_WEB_API_KEY;

/**
 * Always returns a generic success payload so callers cannot probe which emails exist.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = typeof body?.email === "string" ? body.email : "";

  if (!isValidResetEmail(email)) {
    return NextResponse.json({ ok: true });
  }

  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) {
    return NextResponse.json({ ok: true });
  }

  try {
    await requestPasswordReset({ email, apiKey });
  } catch {
    // Swallow — public response stays generic.
  }

  return NextResponse.json({ ok: true });
}
