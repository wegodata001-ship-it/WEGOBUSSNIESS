"use client";

import { useAppSession } from "@/components/providers/auth-provider";
import { hasPermission, isSuperAdmin } from "@/lib/permissions/engine";
import type { Permission } from "@/types/permissions";

export function useBusinessContext() {
  const session = useAppSession();
  const superAdmin = isSuperAdmin(session.user);

  function can(permission: Permission) {
    return superAdmin || hasPermission(session.permissions, permission);
  }

  return {
    user: session.user,
    business: session.business,
    membership: session.membership,
    permissions: session.permissions,
    hasBusiness: Boolean(session.business),
    isSuperAdmin: superAdmin,
    can,
  };
}
