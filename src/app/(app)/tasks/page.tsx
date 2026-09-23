"use client";

import { Suspense } from "react";
import { TasksManageView } from "@/components/admin/tasks-manage-view";
import { Spinner } from "@/components/ui/spinner";

export default function TasksPage() {
  return (
    <Suspense fallback={<Spinner label="טוען משימות…" />}>
      <TasksManageView />
    </Suspense>
  );
}
