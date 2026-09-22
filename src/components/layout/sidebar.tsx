"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAppSession } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { APP_NAME } from "@/lib/env";
import { MAIN_NAV, PLATFORM_NAV, type NavItem } from "@/lib/navigation";
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
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
        active
          ? "bg-white/10 text-white shadow-[inset_3px_0_0_#f5c518]"
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
  const main = MAIN_NAV.filter((item) => canSee(item, permissions, superAdmin));
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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {main.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
        {platform.length > 0 ? (
          <div className="pt-4">
            {platform.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
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
