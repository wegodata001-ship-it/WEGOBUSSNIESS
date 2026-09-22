"use client";

import type { LucideIcon } from "lucide-react";
import { ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import type { MessageKey } from "@/lib/i18n/types";
import type { Permission } from "@/types/permissions";

export function DataPage({
  titleKey,
  descriptionKey,
  emptyKey,
  icon,
  permission,
  superAdminOnly = false,
  items,
  children,
}: {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  emptyKey: MessageKey;
  icon: LucideIcon;
  permission?: Permission;
  superAdminOnly?: boolean;
  items: unknown[];
  children: ReactNode;
}) {
  const { can, isSuperAdmin } = useBusinessContext();
  const { t } = useI18n();
  const allowed = superAdminOnly
    ? isSuperAdmin
    : !permission || can(permission);

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

      {!allowed ? (
        <EmptyState
          icon={ShieldOff}
          title={t("common.noAccessTitle")}
          description={t("empty.noAccess")}
        />
      ) : items.length === 0 ? (
        <EmptyState icon={icon} title={t(emptyKey)} />
      ) : (
        children
      )}
    </div>
  );
}
