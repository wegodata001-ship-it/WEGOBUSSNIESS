"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { DataPage } from "@/components/modules/data-page";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { ListRow } from "@/components/ui/list-row";
import { Spinner } from "@/components/ui/spinner";
import { listBusinessDepartments } from "@/lib/data/departments";
import type { Department } from "@/types/department";

export function DepartmentsView() {
  const { business, can } = useBusinessContext();
  const { t } = useI18n();
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const allowed = can("departments.view");

  useEffect(() => {
    if (!allowed) {
      setItems([]);
      setLoading(false);
      return;
    }
    let active = true;
    void listBusinessDepartments(business?.id ?? null).then((result) => {
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
      titleKey="nav.departments"
      descriptionKey="modules.departments.description"
      emptyKey="empty.departments"
      icon={Building2}
      permission="departments.view"
      items={items}
    >
      <div className="space-y-2">
        {items.map((department) => (
          <ListRow
            key={department.id}
            title={department.name}
            meta={department.slug}
            badge={
              <span className="text-xs text-slate-500">
                {department.isActive ? t("common.active") : t("common.inactive")}
              </span>
            }
          />
        ))}
      </div>
    </DataPage>
  );
}
