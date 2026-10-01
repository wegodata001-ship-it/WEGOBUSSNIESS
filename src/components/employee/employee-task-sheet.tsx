"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Field, GhostButton, PrimaryButton, inputClass } from "@/components/admin/ui";
import { progressFromStatus, statusFromProgress } from "@/components/admin/work-task-panel";
import { useI18n } from "@/components/providers/i18n-provider";
import { employeeName, projectName } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { displayTaskStatus, TASK_WRITE_STATUSES, type Task, type TaskWriteStatus } from "@/types/task";
import type { Employee } from "@/types/employee";
import type { Project } from "@/types/department";

export function EmployeeTaskSheet({
  task,
  employees,
  projects,
  canWork,
  busy,
  error,
  onClose,
  onFinish,
  onStatus,
  onSaveWork,
}: {
  task: Task;
  employees: Employee[];
  projects: Project[];
  canWork: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onFinish: () => void;
  onStatus: (status: TaskWriteStatus) => void;
  onSaveWork: (data: { scheduledDate?: string | null; startTime?: string | null; description?: string }) => void;
}) {
  const { t } = useI18n();
  const project = projects.find((item) => item.id === task.projectId);
  const [scheduledDate, setScheduledDate] = useState(task.scheduledDate || task.startDate || task.dueDate || "");
  const [startTime, setStartTime] = useState(task.startTime || "");
  const [notes, setNotes] = useState(task.description || "");

  useEffect(() => {
    setScheduledDate(task.scheduledDate || task.startDate || task.dueDate || "");
    setStartTime(task.startTime || "");
    setNotes(task.description || "");
  }, [task]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const progress = progressFromStatus(task.status);
  const status = displayTaskStatus(task.status);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label={t("common.close")} onClick={onClose} />
      <aside className="relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl lg:h-full lg:max-h-none lg:max-w-md lg:rounded-none">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs text-slate-500">{t("work.taskDetails")}</p>
            <h2 className="text-lg font-semibold text-[#0F172A]">{task.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <p><span className="block text-xs text-slate-500">{t("common.project")}</span>{projectName(projects, task.projectId)}</p>
            <p><span className="block text-xs text-slate-500">{t("common.client")}</span>{project?.clientName?.trim() || "—"}</p>
            <p><span className="block text-xs text-slate-500">{t("common.assignee")}</span>{employeeName(employees, task.assigneeId)}</p>
            <p><span className="block text-xs text-slate-500">{t("common.deadline")}</span>{task.dueDate || "—"}</p>
          </div>

          <Field label={t("work.moveDay")}>
            <input
              type="date"
              className={inputClass}
              value={scheduledDate}
              disabled={!canWork}
              onChange={(event) => {
                setScheduledDate(event.target.value);
                onSaveWork({ scheduledDate: event.target.value || null });
              }}
            />
          </Field>
          <Field label={t("work.hour")}>
            <input
              type="time"
              className={inputClass}
              value={startTime}
              disabled={!canWork}
              onChange={(event) => {
                setStartTime(event.target.value);
                onSaveWork({ startTime: event.target.value || null });
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.status")}>
              <select
                className={inputClass}
                value={status}
                disabled={!canWork}
                onChange={(event) => onStatus(event.target.value as TaskWriteStatus)}
              >
                {TASK_WRITE_STATUSES.filter((item) => item !== "ARCHIVED").map((item) => (
                  <option key={item} value={item}>
                    {labelOf(item)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("common.progress")}>
              <select
                className={inputClass}
                value={progress >= 100 ? 100 : progress >= 25 ? 50 : 0}
                disabled={!canWork}
                onChange={(event) => onStatus(statusFromProgress(Number(event.target.value)))}
              >
                <option value={0}>0%</option>
                <option value={50}>50%</option>
                <option value={100}>100%</option>
              </select>
            </Field>
          </div>
          <Field label={t("common.notes")}>
            <textarea className={`${inputClass} h-28 py-2`} value={notes} disabled={!canWork} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          {canWork ? (
            <GhostButton onClick={() => onSaveWork({ description: notes })}>{t("work.saveNote")}</GhostButton>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="space-y-2 border-t border-slate-100 px-5 py-4">
          {canWork && status !== "DONE" ? (
            <PrimaryButton disabled={busy} onClick={onFinish}>{t("work.markDone")}</PrimaryButton>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link href={`/tasks?taskId=${task.id}`} className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700">
              {t("work.openFull")}
            </Link>
            <GhostButton onClick={onClose}>{t("common.close")}</GhostButton>
          </div>
        </div>
      </aside>
    </div>
  );
}
