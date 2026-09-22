import { cookies } from "next/headers";
import { AUTH_COOKIE, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth/request-token";

const WEEK = 60 * 60 * 24 * 7;

function cookieOptions(maxAge: number) {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export async function writeSessionCookies(idToken: string, refreshToken?: string) {
  const store = await cookies();
  store.set(AUTH_COOKIE, "1", cookieOptions(WEEK));
  store.set(SESSION_COOKIE, idToken, cookieOptions(WEEK));
  if (refreshToken) {
    store.set(REFRESH_COOKIE, refreshToken, cookieOptions(WEEK));
  }
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  store.delete(SESSION_COOKIE);
  store.delete(REFRESH_COOKIE);
}
