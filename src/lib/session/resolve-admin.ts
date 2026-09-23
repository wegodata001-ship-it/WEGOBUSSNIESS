import { getFirebaseWebApiKey } from "@/lib/env";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { toAppUser, toBusiness, toMembership } from "@/lib/firebase/converters";
import { businessDocPath, memberDocPath, userDocPath } from "@/lib/firebase/paths";
import { isSuperAdmin, resolvePermissions } from "@/lib/permissions/engine";
import type { ResolveResult } from "@/types/session";

export async function resolveSessionByUid(uid: string): Promise<ResolveResult> {
  const db = getAdminDb();
  const userSnap = await db.doc(userDocPath(uid)).get();

  if (!userSnap.exists) {
    return { status: "blocked", reason: "no_membership" };
  }

  const user = toAppUser(userSnap.id, userSnap.data()!);
  if (!user.isActive) {
    return { status: "blocked", reason: "inactive_user" };
  }

  if (!user.defaultBusinessId) {
    if (isSuperAdmin(user)) {
      return { status: "ready", user, business: null, membership: null, permissions: [] };
    }
    return { status: "blocked", reason: "no_business" };
  }

  const [businessSnap, memberSnap] = await Promise.all([
    db.doc(businessDocPath(user.defaultBusinessId)).get(),
    db.doc(memberDocPath(user.defaultBusinessId, uid)).get(),
  ]);

  if (!businessSnap.exists) {
    if (isSuperAdmin(user)) {
      return { status: "ready", user, business: null, membership: null, permissions: [] };
    }
    return { status: "blocked", reason: "no_business" };
  }

  const business = toBusiness(businessSnap.id, businessSnap.data()!);

  if (!memberSnap.exists) {
    if (isSuperAdmin(user)) {
      return { status: "ready", user, business, membership: null, permissions: [] };
    }
    return { status: "blocked", reason: "no_membership" };
  }

  const membership = toMembership(memberSnap.data()!, business.id);
  if (!membership.isActive && !isSuperAdmin(user)) {
    return { status: "blocked", reason: "inactive_membership" };
  }

  return {
    status: "ready",
    user,
    business,
    membership,
    permissions: resolvePermissions(membership),
  };
}

export async function verifyOrRefreshUid(idToken: string, refreshToken?: string) {
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch {
    if (!refreshToken) return null;
    const apiKey = getFirebaseWebApiKey();
    if (!apiKey) return null;

    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      },
    );
    const payload = (await response.json()) as { id_token?: string; refresh_token?: string };
    if (!payload.id_token) return null;
    const decoded = await getAdminAuth().verifyIdToken(payload.id_token);
    return {
      uid: decoded.uid,
      idToken: payload.id_token,
      refreshToken: payload.refresh_token,
    };
  }
}
