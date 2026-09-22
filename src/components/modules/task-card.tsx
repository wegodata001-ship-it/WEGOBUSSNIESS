"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { finishTask, startTask } from "@/lib/tasks/actions";
import { ACTIVE_TASK_STATUSES, type Task } from "@/types/task";

export function TaskCard({
  task,
  businessId,
  canStart,
  canFinish,
  onChanged,
}: {
  task: Task;
  businessId: string;
  canStart: boolean;
  canFinish: boolean;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const active = ACTIVE_TASK_STATUSES.includes(task.status);

  async function run(action: "start" | "finish") {
    setBusy(true);
    try {
      if (action === "start") await startTask(businessId, task.id);
      else await finishTask(businessId, task.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-[var(--radius)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{task.title}</p>
          {task.collaboratorIds.length ? (
            <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              משימה משותפת
            </span>
          ) : null}
          {task.description ? (
            <p className="mt-1 text-sm leading-6 text-slate-500">{task.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            {task.priority} · {task.status}
            {task.estimatedHours ? ` · ${task.estimatedHours}h` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {canStart && active && task.status !== "IN_PROGRESS" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("start")}
              className="h-9 rounded-xl bg-[var(--brand-primary)] px-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {t("tasks.start")}
            </button>
          ) : null}
          {canFinish && task.status === "IN_PROGRESS" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("finish")}
              className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              {t("tasks.finish")}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
