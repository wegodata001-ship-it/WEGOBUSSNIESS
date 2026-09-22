"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { TaskCard } from "@/components/modules/task-card";
import { DataPage } from "@/components/modules/data-page";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { Spinner } from "@/components/ui/spinner";
import { listBusinessTasks } from "@/lib/data/tasks";
import type { Task } from "@/types/task";

export function TasksView() {
  const { business, membership, can, isSuperAdmin } = useBusinessContext();
  const { t } = useI18n();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const allowed = can("tasks.view");
  const viewAll = isSuperAdmin || can("tasks.viewAll");

  const load = useCallback(() => {
    if (!allowed) {
      setItems([]);
      setLoading(false);
      return;
    }
    void listBusinessTasks(business?.id ?? null, {
      viewAll,
      assigneeEmployeeId: membership?.employeeId,
    }).then((result) => {
      setItems(result.data);
      setLoading(false);
    });
  }, [allowed, business?.id, membership?.employeeId, viewAll]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label={t("common.loading")} />;

  return (
    <DataPage
      titleKey="nav.tasks"
      descriptionKey="modules.tasks.description"
      emptyKey="empty.tasks"
      icon={ClipboardList}
      permission="tasks.view"
      items={items}
    >
      <div className="space-y-3">
        {items.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            businessId={business!.id}
            canStart={can("tasks.start")}
            canFinish={can("tasks.complete")}
            onChanged={load}
          />
        ))}
      </div>
    </DataPage>
  );
}
