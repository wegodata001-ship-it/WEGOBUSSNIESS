import { NextResponse } from "next/server";
import { readRefreshToken, readRequestToken } from "@/lib/auth/request-token";
import { getAdminDb } from "@/lib/firebase/admin";
import { userDocPath } from "@/lib/firebase/paths";
import { verifyOrRefreshUid } from "@/lib/session/resolve-admin";
import { resolveLocale } from "@/types/roles";

export async function POST(request: Request) {
  const token = readRequestToken(request);
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const verified = await verifyOrRefreshUid(token, readRefreshToken(request));
  if (!verified) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { locale?: string };
  const locale = resolveLocale(body.locale);
  await getAdminDb().doc(userDocPath(verified.uid)).set({ locale, updatedAt: new Date() }, { merge: true });
  return NextResponse.json({ ok: true, locale });
}
