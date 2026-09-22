"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { DataPage } from "@/components/modules/data-page";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { ListRow } from "@/components/ui/list-row";
import { Spinner } from "@/components/ui/spinner";
import { listPlatformUsers } from "@/lib/data/businesses";
import type { MessageKey } from "@/lib/i18n/types";
import type { AppUser } from "@/types/user";

export function PlatformUsersView() {
  const { business, isSuperAdmin } = useBusinessContext();
  const { t } = useI18n();
  const [items, setItems] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) {
      setItems([]);
      setLoading(false);
      return;
    }

    let active = true;
    void listPlatformUsers(business?.id).then((result) => {
      if (active) {
        setItems(result.data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [business?.id, isSuperAdmin]);

  if (loading) return <Spinner label={t("common.loading")} />;

  return (
    <DataPage
      titleKey="nav.adminUsers"
      descriptionKey="modules.adminUsers.description"
      emptyKey="empty.adminUsers"
      icon={Users}
      superAdminOnly
      items={items}
    >
      <div className="space-y-2">
        {items.map((user) => (
          <ListRow
            key={user.id}
            title={user.displayName || user.email}
            meta={user.email}
            badge={
              <span className="text-xs text-slate-500">
                {user.platformRole
                  ? t(`roles.${user.platformRole}` as MessageKey)
                  : t("common.user")}
              </span>
            }
          />
        ))}
      </div>
    </DataPage>
  );
}
