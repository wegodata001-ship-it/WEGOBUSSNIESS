"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { DataPage } from "@/components/modules/data-page";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { ListRow } from "@/components/ui/list-row";
import { Spinner } from "@/components/ui/spinner";
import { listBusinessMembers } from "@/lib/data/members";
import type { MessageKey } from "@/lib/i18n/types";
import type { Membership } from "@/types/membership";

export function MembersView() {
  const { business, can } = useBusinessContext();
  const { t } = useI18n();
  const [items, setItems] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const allowed = can("users.view");

  useEffect(() => {
    if (!allowed) {
      setItems([]);
      setLoading(false);
      return;
    }

    let active = true;
    void listBusinessMembers(business?.id ?? null).then((result) => {
      if (active) {
        setItems(result.data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [allowed, business?.id]);

  if (loading) return <Spinner label={t("common.loading")} />;

  return (
    <DataPage
      titleKey="nav.users"
      descriptionKey="modules.users.description"
      emptyKey="empty.users"
      icon={Users}
      permission="users.view"
      items={items}
    >
      <div className="space-y-2">
        {items.map((member) => (
          <ListRow
            key={member.userId}
            title={member.displayName || member.email || member.userId}
            meta={member.email || member.userId}
            badge={
              <span className="text-xs text-slate-500">
                {t(`roles.${member.role}` as MessageKey)}
              </span>
            }
          />
        ))}
      </div>
    </DataPage>
  );
}
