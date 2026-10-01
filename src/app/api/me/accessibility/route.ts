import { NextResponse } from "next/server";
import { readRefreshToken, readRequestToken } from "@/lib/auth/request-token";
import { getAdminDb } from "@/lib/firebase/admin";
import { userDocPath } from "@/lib/firebase/paths";
import { verifyOrRefreshUid } from "@/lib/session/resolve-admin";
import { normalizeA11yPrefs } from "@/lib/a11y/prefs";

export async function POST(request: Request) {
  const token = readRequestToken(request);
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const verified = await verifyOrRefreshUid(token, readRefreshToken(request));
  if (!verified) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const prefs = normalizeA11yPrefs(await request.json().catch(() => ({})));
  await getAdminDb().doc(userDocPath(verified.uid)).set({ accessibility: prefs, updatedAt: new Date() }, { merge: true });
  return NextResponse.json({ ok: true, accessibility: prefs });
}
