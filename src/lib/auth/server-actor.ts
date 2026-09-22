import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { readRefreshToken, readRequestToken } from "@/lib/auth/request-token";
import { toMembership } from "@/lib/firebase/converters";
import { memberDocPath, userDocPath } from "@/lib/firebase/paths";
import { hasPermission, isSuperAdmin, resolvePermissions } from "@/lib/permissions/engine";
import { verifyOrRefreshUid } from "@/lib/session/resolve-admin";
import type { Permission } from "@/types/permissions";

export type ServerActor = {
  uid: string;
  businessId: string;
  employeeId: string | null;
  permissions: Permission[];
  isOwnerOrManager: boolean;
  isSuperAdmin: boolean;
};

export async function requireActor(request: Request, businessId: string) {
  const token = readRequestToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  }

  try {
    const verified = await verifyOrRefreshUid(token, readRefreshToken(request));
    if (!verified) {
      return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
    }
    const db = getAdminDb();
    const userSnap = await db.doc(userDocPath(verified.uid)).get();
    if (!userSnap.exists) {
      return { error: NextResponse.json({ error: "NO_USER" }, { status: 403 }) };
    }

    const platformRole = userSnap.data()?.platformRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : null;
    const superAdmin = isSuperAdmin({ platformRole });
    const memberSnap = await db.doc(memberDocPath(businessId, verified.uid)).get();
    if (!memberSnap.exists && !superAdmin) {
      return { error: NextResponse.json({ error: "NO_MEMBERSHIP" }, { status: 403 }) };
    }

    const membership = memberSnap.exists ? toMembership(memberSnap.data()!, businessId) : null;
    if (membership && !membership.isActive && !superAdmin) {
      return { error: NextResponse.json({ error: "INACTIVE_MEMBERSHIP" }, { status: 403 }) };
    }

    const permissions = membership ? resolvePermissions(membership) : [];
    return {
      actor: {
        uid: verified.uid,
        businessId,
        employeeId: membership?.employeeId ?? null,
        permissions,
        isOwnerOrManager: superAdmin || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER",
        isSuperAdmin: superAdmin,
      } satisfies ServerActor,
    };
  } catch {
    return { error: NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 }) };
  }
}

export function actorCan(actor: ServerActor, permission: Permission) {
  return actor.isSuperAdmin || hasPermission(actor.permissions, permission);
}
