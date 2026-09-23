"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAppSession } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { APP_NAME } from "@/lib/env";
import { NAV_GROUPS, PLATFORM_NAV, type NavItem } from "@/lib/navigation";
import { hasPermission, isSuperAdmin } from "@/lib/permissions/engine";
import type { MessageKey } from "@/lib/i18n/types";
import type { Permission } from "@/types/permissions";

function canSee(item: NavItem, permissions: readonly Permission[], superAdmin: boolean) {
  if (item.superAdminOnly) return superAdmin;
  if (!item.permission) return true;
  return superAdmin || hasPermission(permissions, item.permission);
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
        active
          ? "bg-white/12 text-white shadow-[inset_3px_0_0_#2563EB]"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}

function RoleLabel() {
  const { user, membership } = useAppSession();
  const { t } = useI18n();
  const roleKey = (
    user.platformRole === "SUPER_ADMIN"
      ? "roles.SUPER_ADMIN"
      : membership
        ? `roles.${membership.role}`
        : "roles.EMPLOYEE"
  ) as MessageKey;
  return <span>{t(roleKey)}</span>;
}

export function Sidebar({
  onNavigate,
  onLogout,
}: {
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const { user, business, permissions } = useAppSession();
  const { t } = useI18n();
  const superAdmin = isSuperAdmin(user);
  const initial = (business?.name || user.displayName || APP_NAME).slice(0, 1);
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(item, permissions, superAdmin)),
  })).filter((group) => group.items.length > 0);
  const platform = PLATFORM_NAV.filter((item) => canSee(item, permissions, superAdmin));

  return (
    <aside className="flex h-full w-[17.5rem] flex-col bg-[var(--sidebar)] text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-sm font-bold">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{business?.name || APP_NAME}</p>
          <p className="truncate text-xs text-slate-400">Business Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {t(group.labelKey)}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
        {platform.length > 0 ? (
          <div>
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {t("nav.admin")}
            </p>
            <div className="space-y-1">
              {platform.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ) : null}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium">{user.displayName || user.email}</p>
        <p className="truncate text-xs text-slate-400">
          תפקיד: <RoleLabel />
        </p>
        <p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );
}
