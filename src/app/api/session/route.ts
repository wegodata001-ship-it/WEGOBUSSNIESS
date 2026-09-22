import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth/request-token";
import { clearSessionCookies } from "@/lib/auth/session-cookies";

export async function POST() {
  const store = await cookies();
  store.set(AUTH_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
