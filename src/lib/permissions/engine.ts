import { ROLE_PERMISSIONS } from "@/lib/permissions/defaults";
import type { Membership } from "@/types/membership";
import type { Permission } from "@/types/permissions";
import type { AppUser } from "@/types/user";

export function isSuperAdmin(user: Pick<AppUser, "platformRole"> | null | undefined) {
  return user?.platformRole === "SUPER_ADMIN";
}

export function permissionsForRole(role: Membership["role"]): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function resolvePermissions(membership: Membership | null): Permission[] {
  if (!membership) return [];

  const granted = new Set<Permission>(permissionsForRole(membership.role));
  for (const permission of membership.permissions) {
    granted.add(permission);
  }
  return [...granted];
}

export function hasPermission(
  permissions: readonly Permission[],
  required: Permission,
) {
  return permissions.includes(required);
}

export function hasAnyPermission(
  permissions: readonly Permission[],
  required: readonly Permission[],
) {
  return required.some((permission) => permissions.includes(permission));
}

export function canUseBusinessApp(user: AppUser, membership: Membership | null) {
  if (!user.isActive) return false;
  if (isSuperAdmin(user)) return true;
  return Boolean(membership?.isActive);
}
