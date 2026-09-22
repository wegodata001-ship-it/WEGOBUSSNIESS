"use client";

import type { LucideIcon } from "lucide-react";
import { ShieldOff } from "lucide-react";
import { useAppSession } from "@/components/providers/auth-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import type { MessageKey } from "@/lib/i18n/types";
import { hasPermission, isSuperAdmin } from "@/lib/permissions/engine";
import type { Permission } from "@/types/permissions";

export function ModulePlaceholder({
  titleKey,
  descriptionKey,
  emptyKey,
  icon,
  permission,
  superAdminOnly = false,
}: {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  emptyKey: MessageKey;
  icon: LucideIcon;
  permission?: Permission;
  superAdminOnly?: boolean;
}) {
  const { user, permissions } = useAppSession();
  const { t } = useI18n();
  const allowed = superAdminOnly
    ? isSuperAdmin(user)
    : !permission || isSuperAdmin(user) || hasPermission(permissions, permission);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t(titleKey)}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          {t(descriptionKey)}
        </p>
      </div>

      {allowed ? (
        <EmptyState
          icon={icon}
          title={t(emptyKey)}
          description={t("modules.comingNext")}
        />
      ) : (
        <EmptyState
          icon={ShieldOff}
          title={t("common.noAccessTitle")}
          description={t("empty.noAccess")}
        />
      )}
    </div>
  );
}
