import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth/request-token";

const WEEK = 60 * 60 * 24 * 7;

function cookieOptions(maxAge: number) {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    maxAge,
  };
}

export function applySessionCookies(response: NextResponse, idToken: string, refreshToken?: string) {
  const options = cookieOptions(WEEK);
  response.cookies.set(AUTH_COOKIE, "1", options);
  response.cookies.set(SESSION_COOKIE, idToken, options);
  if (refreshToken) {
    response.cookies.set(REFRESH_COOKIE, refreshToken, options);
  }
  return response;
}

export async function writeSessionCookies(idToken: string, refreshToken?: string) {
  const store = await cookies();
  const options = cookieOptions(WEEK);
  store.set(AUTH_COOKIE, "1", options);
  store.set(SESSION_COOKIE, idToken, options);
  if (refreshToken) {
    store.set(REFRESH_COOKIE, refreshToken, options);
  }
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  store.delete(SESSION_COOKIE);
  store.delete(REFRESH_COOKIE);
}
