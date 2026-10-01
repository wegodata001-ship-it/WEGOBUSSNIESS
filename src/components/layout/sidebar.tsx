"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAppSession } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
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
  const { membership } = useAppSession();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  const label = item.href === "/dashboard" && membership?.role === "EMPLOYEE" ? t("nav.myWork") : t(item.labelKey);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg border-s-2 px-3 py-2 text-[15px] transition ${
        active
          ? "border-s-[#2563EB] bg-white/10 text-white"
          : "border-s-transparent text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
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
          <p className="truncate text-xs text-slate-300">Business Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {t(group.labelKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
        {platform.length > 0 ? (
          <div>
            <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {t("nav.admin")}
            </p>
            <div className="space-y-0.5">
              {platform.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ) : null}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold">{user.displayName || user.email}</p>
        <p className="truncate text-xs text-slate-400">
          {t("common.role")}: <RoleLabel />
        </p>
        <p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>
        <div className="mt-3 lg:hidden">
          <LanguageSwitcher />
        </div>
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
