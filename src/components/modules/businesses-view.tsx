"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { DataPage } from "@/components/modules/data-page";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { ListRow } from "@/components/ui/list-row";
import { Spinner } from "@/components/ui/spinner";
import { listBusinesses } from "@/lib/data/businesses";
import type { Business } from "@/types/business";

export function BusinessesView() {
  const { business, isSuperAdmin } = useBusinessContext();
  const { t } = useI18n();
  const [items, setItems] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) {
      setItems([]);
      setLoading(false);
      return;
    }

    let active = true;
    void listBusinesses(business?.id).then((result) => {
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
      titleKey="nav.adminBusinesses"
      descriptionKey="modules.adminBusinesses.description"
      emptyKey="empty.adminBusinesses"
      icon={Building2}
      superAdminOnly
      items={items}
    >
      <div className="space-y-2">
        {items.map((business) => (
          <ListRow
            key={business.id}
            title={business.name}
            meta={business.slug}
            badge={<span className="text-xs text-slate-500">{business.status}</span>}
          />
        ))}
      </div>
    </DataPage>
  );
}
