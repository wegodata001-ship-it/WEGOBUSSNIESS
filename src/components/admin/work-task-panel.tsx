"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Field, GhostButton, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { labelOf } from "@/lib/admin/labels";
import { displayTaskStatus, TASK_WRITE_STATUSES, type Task, type TaskWriteStatus } from "@/types/task";
import type { Employee } from "@/types/employee";
import type { Project } from "@/types/department";

function progressFromStatus(status: string) {
  if (status === "DONE" || status === "COMPLETED") return 100;
  if (status === "IN_PROGRESS") return 50;
  if (status === "WAITING") return 25;
  return 0;
}

function statusFromProgress(value: number): TaskWriteStatus {
  if (value >= 100) return "DONE";
  if (value >= 25) return "IN_PROGRESS";
  return "TODO";
}

export type WorkTaskDraft = {
  title: string;
  description: string;
  projectId: string;
  assigneeId: string;
  status: TaskWriteStatus;
  dueDate: string;
  progress: number;
};

export function draftFromWorkTask(task: Task): WorkTaskDraft {
  return {
    title: task.title,
    description: task.description,
    projectId: task.projectId ?? "",
    assigneeId: task.assigneeId ?? "",
    status: displayTaskStatus(task.status),
    dueDate: task.dueDate ?? "",
    progress: progressFromStatus(task.status),
  };
}

export function WorkTaskPanel({
  task,
  draft,
  employees,
  projects,
  canManage,
  busy,
  error,
  onChange,
  onClose,
  onSave,
}: {
  task: Task;
  draft: WorkTaskDraft;
  employees: Employee[];
  projects: Project[];
  canManage: boolean;
  busy: boolean;
  error: string | null;
  onChange: (draft: WorkTaskDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const project = projects.find((item) => item.id === (draft.projectId || task.projectId));
  const client = project?.clientName?.trim() || "—";

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label={t("common.close")} onClick={onClose} />
      <aside className={`relative flex h-full w-full max-w-md flex-col bg-white shadow-xl transition ${mounted ? "translate-x-0" : "translate-x-4"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs text-slate-500">{t("work.quickEdit")}</p>
            <h2 className="text-lg font-semibold text-[#0F172A]">{t("work.task")}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Field label={t("work.taskName")}>
            <input className={inputClass} value={draft.title} disabled={!canManage} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
          </Field>
          <Field label={t("common.project")}>
            <select className={inputClass} value={draft.projectId} disabled={!canManage} onChange={(event) => onChange({ ...draft, projectId: event.target.value })}>
              <option value="">{t("common.noProject")}</option>
              {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label={t("common.client")}>
            <input className={inputClass} value={client} readOnly />
          </Field>
          <Field label={t("work.employee")}>
            <select className={inputClass} value={draft.assigneeId} disabled={!canManage} onChange={(event) => onChange({ ...draft, assigneeId: event.target.value })}>
              <option value="">{t("common.unassigned")}</option>
              {employees.filter((item) => item.status === "ACTIVE" || item.id === draft.assigneeId).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.status")}>
              <select
                className={inputClass}
                value={draft.status}
                disabled={!canManage}
                onChange={(event) => {
                  const status = event.target.value as TaskWriteStatus;
                  onChange({ ...draft, status, progress: progressFromStatus(status) });
                }}
              >
                {TASK_WRITE_STATUSES.filter((item) => item !== "ARCHIVED").map((item) => (
                  <option key={item} value={item}>{labelOf(item)}</option>
                ))}
              </select>
            </Field>
            <Field label={t("work.percent")}>
              <select
                className={inputClass}
                value={draft.progress >= 100 ? 100 : draft.progress >= 25 ? 50 : 0}
                disabled={!canManage}
                onChange={(event) => {
                  const progress = Number(event.target.value);
                  onChange({ ...draft, progress, status: statusFromProgress(progress) });
                }}
              >
                <option value={0}>0%</option>
                <option value={50}>50%</option>
                <option value={100}>100%</option>
              </select>
            </Field>
          </div>
          <Field label={t("common.deadline")}>
            <input type="date" className={inputClass} value={draft.dueDate} disabled={!canManage} onChange={(event) => onChange({ ...draft, dueDate: event.target.value })} />
          </Field>
          <Field label={t("common.notes")}>
            <textarea
              className={`${inputClass} h-28 py-2`}
              value={draft.description}
              disabled={!canManage}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <Link href={`/tasks?taskId=${task.id}`} className="text-sm font-medium text-[#2563EB]">{t("work.fullPage")}</Link>
          <div className="flex gap-2">
            <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
            {canManage ? <PrimaryButton disabled={busy || !draft.title.trim()} onClick={onSave}>{t("common.save")}</PrimaryButton> : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

export { progressFromStatus, statusFromProgress };
