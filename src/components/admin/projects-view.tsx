"use client";

import Link from "next/link";
import { useState } from "react";
import { FolderKanban } from "lucide-react";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { mutateBusiness } from "@/lib/admin/api";
import { employeeName, sessionHours, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { isOverdue, taskIsActive } from "@/lib/admin/time";
import { todayInTimeZone } from "@/lib/dates/format";
import { PROJECT_STATUSES, type Project } from "@/types/department";

type ProjectDraft = {
  id?: string;
  name: string;
  clientName: string;
  description: string;
  managerEmployeeId: string;
  startDate: string;
  dueDate: string;
  status: string;
};

export function ProjectsView() {
  const { business, permissions, membership } = useBusinessContext();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const canManage = permissions.includes("projects.manage") || membership?.role === "BUSINESS_OWNER";
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label="טוען פרויקטים…" />;

  const visible = data.projects.filter((item) => showArchive || item.isActive);

  async function save() {
    if (!business?.id || !draft?.name.trim()) return;
    setBusy(true);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: draft.id ? "updateProject" : "createProject",
        id: draft.id,
        data: {
          name: draft.name,
          clientName: draft.clientName,
          description: draft.description,
          managerEmployeeId: draft.managerEmployeeId,
          startDate: draft.startDate,
          dueDate: draft.dueDate,
          status: draft.status,
          isActive: true,
        },
      });
      setDraft(null);
      await reload();
    } catch (error) {
      window.alert(error instanceof Error && error.message === "DUPLICATE_PROJECT" ? "פרויקט בשם זה כבר קיים" : "שמירת הפרויקט נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, project: Project, extra?: Record<string, unknown>) {
    if (!business?.id) return;
    setBusy(true);
    try {
      await mutateBusiness({ businessId: business.id, action, id: project.id, data: extra });
      await reload();
    } catch (error) {
      window.alert(error instanceof Error && error.message === "PROJECT_IN_USE"
        ? "לא ניתן למחוק פרויקט שמקושר למשימות, פגישות או מסמכים. אפשר להעביר לארכיון."
        : "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  function openDraft(project?: Project) {
    setDraft({
      id: project?.id,
      name: project?.name ?? "",
      clientName: project?.clientName ?? "",
      description: project?.description ?? "",
      managerEmployeeId: project?.managerEmployeeId ?? "",
      startDate: project?.startDate ?? today,
      dueDate: project?.dueDate ?? today,
      status: project?.status ?? "ACTIVE",
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="כרטסת פרויקט"
        subtitle="כל הפרויקטים, הלקוחות וההתקדמות במקום אחד"
        actions={
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showArchive} onChange={(event) => setShowArchive(event.target.checked)} />
              הצג ארכיון
            </label>
            {canManage ? <PrimaryButton onClick={() => openDraft()}>+ פרויקט חדש</PrimaryButton> : null}
          </div>
        }
      />
      {visible.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => {
            const tasks = data.tasks.filter((task) => task.projectId === project.id);
            const done = tasks.filter((task) => task.status === "DONE" || task.status === "COMPLETED").length;
            const late = tasks.filter((task) => isOverdue(task, today)).length;
            const hours = sessionHours(data.sessions.filter((session) => tasks.some((task) => task.id === session.taskId)));
            const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
            return (
              <article key={project.id} className="rounded-[var(--radius)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow)]">
                <Link href={`/projects/${project.id}`} className="block hover:opacity-90">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{project.name}</p>
                      <p className="text-sm text-slate-500">{project.clientName || "ללא לקוח"}</p>
                    </div>
                    <StatusBadge value={project.isActive ? project.status : "ARCHIVED"} label={project.isActive ? labelOf(project.status) : "ארכיון"} />
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-[var(--brand-primary)]" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {progress}% · {hours} שעות · {tasks.filter(taskIsActive).length} פתוחות · {late} באיחור
                  </p>
                  <p className="mt-1 text-xs text-slate-400">מנהל: {employeeName(data.employees, project.managerEmployeeId)}</p>
                </Link>
                {canManage ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    <GhostButton onClick={() => openDraft(project)}>עריכה</GhostButton>
                    <select
                      className="h-10 rounded-xl border border-slate-200 px-2 text-xs"
                      value={project.status}
                      disabled={busy}
                      onChange={(event) => void act("updateProject", project, {
                        name: project.name,
                        clientName: project.clientName,
                        description: project.description,
                        managerEmployeeId: project.managerEmployeeId,
                        startDate: project.startDate,
                        dueDate: project.dueDate,
                        status: event.target.value,
                        isActive: project.isActive,
                      })}
                    >
                      {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
                    </select>
                    <GhostButton disabled={busy} onClick={() => void act(project.isActive ? "archiveProject" : "restoreProject", project)}>
                      {project.isActive ? "ארכיון" : "שחזור"}
                    </GhostButton>
                    <GhostButton disabled={busy} onClick={() => void act("deleteProject", project)}>מחיקה</GhostButton>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={FolderKanban} title="אין פרויקטים עדיין" action={canManage ? <PrimaryButton onClick={() => openDraft()}>+ יצירת פרויקט</PrimaryButton> : undefined} />
      )}

      {draft ? (
        <Modal title={draft.id ? "עריכת פרויקט" : "פרויקט חדש"} onClose={() => setDraft(null)}>
          <div className="grid gap-3">
            <Field label="שם פרויקט"><input className={inputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
            <Field label="לקוח"><input className={inputClass} value={draft.clientName} onChange={(event) => setDraft({ ...draft, clientName: event.target.value })} /></Field>
            <Field label="תיאור"><textarea className={`${inputClass} h-24 py-2`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
            <Field label="מנהל פרויקט">
              <select className={inputClass} value={draft.managerEmployeeId} onChange={(event) => setDraft({ ...draft, managerEmployeeId: event.target.value })}>
                <option value="">ללא</option>
                {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
              </select>
            </Field>
            <Field label="סטטוס">
              <select className={inputClass} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
              </select>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="התחלה"><input className={inputClass} value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></Field>
              <Field label="Deadline"><input className={inputClass} value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setDraft(null)}>ביטול</GhostButton>
              <PrimaryButton disabled={busy || !draft.name.trim()} onClick={() => void save()}>שמירה</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
