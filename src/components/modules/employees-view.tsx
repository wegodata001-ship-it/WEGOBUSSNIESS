"use client";

import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import { DataPage } from "@/components/modules/data-page";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { ListRow } from "@/components/ui/list-row";
import { Spinner } from "@/components/ui/spinner";
import { listBusinessEmployees } from "@/lib/data/employees";
import type { Employee } from "@/types/employee";

export function EmployeesView() {
  const { business, can } = useBusinessContext();
  const { t } = useI18n();
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const allowed = can("employees.view");

  useEffect(() => {
    if (!allowed) {
      setItems([]);
      setLoading(false);
      return;
    }

    let active = true;
    void listBusinessEmployees(business?.id ?? null).then((result) => {
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
      titleKey="nav.employees"
      descriptionKey="modules.employees.description"
      emptyKey="empty.employees"
      icon={Briefcase}
      permission="employees.view"
      items={items}
    >
      <div className="space-y-2">
        {items.map((employee) => (
          <ListRow
            key={employee.id}
            title={employee.displayName || `${employee.firstName} ${employee.lastName}`.trim()}
            meta={employee.jobTitle || employee.email || undefined}
            badge={
              <span className="text-xs text-slate-500">
                {employee.status === "ACTIVE" ? t("common.active") : t("common.inactive")}
              </span>
            }
          />
        ))}
      </div>
    </DataPage>
  );
}
