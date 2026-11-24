"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { WorkBoard } from "@/components/admin/work-board";
import { type WorkTaskDraft } from "@/components/admin/work-task-panel";
import { TaskFormModal, draftFromTask, emptyTaskDraft, taskDraftPayload, type TaskDraft } from "@/components/admin/task-form-modal";
import { PrimaryButton } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { changeBusinessTaskStatus, mutateBusiness, saveBusinessTask, taskMutationMessage } from "@/lib/admin/api";
import { useBusinessCatalog } from "@/lib/admin/catalog";
import { buildDashboardModel } from "@/lib/admin/dashboard-model";
import { todayInTimeZone } from "@/lib/dates/format";
import { finishTask } from "@/lib/tasks/actions";
import { displayTaskStatus, type Task, type TaskWriteStatus } from "@/types/task";

function taskPatchPayload(task: Task, today: string, overrides: Record<string, unknown> = {}) {
  const base = draftFromTask(task, today);
  return {
    ...taskDraftPayload(base),
    status: task.status === "COMPLETED" || task.status === "DONE" ? "DONE" : displayTaskStatus(task.status),
    ...overrides,
  };
}

export function AdminDashboard() {
  const { t } = useI18n();
  const { user, business, membership, permissions } = useBusinessContext();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const timeZone = business?.timezone || "Asia/Jerusalem";
  const model = useMemo(() => buildDashboardModel(data, today, timeZone), [data, timeZone, today]);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    setLocalTasks(null);
  }, [data.tasks]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const canCreateTask = permissions.includes("tasks.create") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canCreateMeeting = permissions.includes("meetings.create") || permissions.includes("meetings.manage") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canCreateEmployee = permissions.includes("employees.manage") || membership?.role === "BUSINESS_OWNER";
  const canManage = permissions.includes("tasks.edit") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canComplete = permissions.includes("tasks.complete") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canDelete = permissions.includes("tasks.delete") || membership?.role === "BUSINESS_OWNER";
  const canEditTeam = canManage;
  const employeeId = membership?.employeeId ?? null;
  const tasks = localTasks ?? data.tasks;

  function patchLocal(id: string, patch: Partial<Task>) {
    setLocalTasks((current) => (current ?? data.tasks).map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }

  async function refresh() {
    await reload({ silent: true });
  }

  async function saveTask() {
    if (!business?.id || !draft?.title.trim()) return { ok: false as const };
    setBusy(true);
    setFormError(null);
    const result = await saveBusinessTask({
      businessId: business.id,
      id: draft.id,
      data: taskDraftPayload(draft),
    });
    setBusy(false);
    if (!result.ok) {
      setFormError(taskMutationMessage(result.error, t));
      return { ok: false as const };
    }
    if (!draft.id && result.id) {
      setDraft((prev) => (prev ? { ...prev, id: result.id } : prev));
    }
    return { ok: true as const, id: result.id };
  }

  async function runAction(task: Task, work: () => Promise<void>, optimistic?: Partial<Task>) {
    if (!business?.id) return;
    if (optimistic) patchLocal(task.id, optimistic);
    setBusyId(task.id);
    try {
      await work();
      await refresh();
    } catch {
      setLocalTasks(null);
      setToast(t("tasks.network"));
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(task: Task, status: TaskWriteStatus) {
    if (!business?.id) return;
    const next = status === "DONE" ? "COMPLETED" : status;
    await runAction(
      task,
      async () => {
        const result = await changeBusinessTaskStatus({ businessId: business.id, id: task.id, status: next });
        if (!result.ok) throw new Error(result.error);
      },
      { status: next },
    );
  }

  async function changeAssignee(task: Task, assigneeId: string) {
    if (!business?.id) return;
    await runAction(
      task,
      async () => {
        await mutateBusiness({
          businessId: business.id,
          action: "assignTask",
          id: task.id,
          data: { assigneeId: assigneeId || null, collaboratorIds: task.collaboratorIds.filter((id) => id !== assigneeId) },
        });
      },
      { assigneeId: assigneeId || null },
    );
  }

  async function changeDueDate(task: Task, dueDate: string) {
    if (!business?.id) return;
    await runAction(
      task,
      async () => {
        const result = await saveBusinessTask({
          businessId: business.id,
          id: task.id,
          data: taskPatchPayload(task, today, { dueDate }),
        });
        if (!result.ok) throw new Error(result.error);
      },
      { dueDate: dueDate || null },
    );
  }

  async function changeProject(task: Task, projectId: string) {
    if (!business?.id) return;
    await runAction(
      task,
      async () => {
        const result = await saveBusinessTask({
          businessId: business.id,
          id: task.id,
          data: taskPatchPayload(task, today, { projectId: projectId || null }),
        });
        if (!result.ok) throw new Error(result.error);
      },
      { projectId: projectId || null },
    );
  }

  async function completeTask(task: Task) {
    if (!business?.id) return;
    await runAction(task, () => finishTask(business.id, task.id), { status: "COMPLETED" });
  }

  async function deleteTask(task: Task) {
    if (!business?.id) return;
    if (!window.confirm(`${t("tasks.confirmDeleteTitle")}\n${task.title}`)) return;
    setBusyId(task.id);
    try {
      await mutateBusiness({ businessId: business.id, action: "deleteTask", id: task.id });
      setLocalTasks((current) => (current ?? data.tasks).filter((item) => item.id !== task.id));
      await refresh();
    } catch (error) {
      setLocalTasks(null);
      const code = error instanceof Error ? error.message : "NETWORK";
      setToast(
        code === "TASK_HAS_PAYMENTS" ? t("tasks.hasPayments")
          : code === "TASK_HAS_WORK_HOURS" ? t("tasks.hasWorkHours")
            : code === "TASK_HAS_DOCUMENTS" ? t("tasks.hasDocuments")
              : code === "TASK_IN_USE" ? t("tasks.inUse")
                : code === "FORBIDDEN" ? t("tasks.forbidden")
                  : t("tasks.network"),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function savePanel(task: Task, panel: WorkTaskDraft) {
    if (!business?.id || !panel.title.trim()) return false;
    const nextStatus = panel.status === "DONE" ? "COMPLETED" : panel.status;
    patchLocal(task.id, {
      title: panel.title,
      description: panel.description,
      projectId: panel.projectId || null,
      assigneeId: panel.assigneeId || null,
      status: nextStatus,
      dueDate: panel.dueDate || null,
    });
    if (panel.status === "DONE" && !["DONE", "COMPLETED"].includes(task.status)) {
      try {
        await finishTask(business.id, task.id);
      } catch {
        setToast(t("tasks.network"));
        setLocalTasks(null);
        return false;
      }
    }
    const result = await saveBusinessTask({
      businessId: business.id,
      id: task.id,
      data: taskPatchPayload(task, today, {
        title: panel.title,
        description: panel.description,
        projectId: panel.projectId || null,
        assigneeId: panel.assigneeId || null,
        dueDate: panel.dueDate || null,
        status: panel.status,
      }),
    });
    if (!result.ok) {
      setToast(taskMutationMessage(result.error, t));
      setLocalTasks(null);
      return false;
    }
    await refresh();
    return true;
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 rounded-2xl bg-white" />
        <div className="h-12 rounded-2xl bg-white" />
        <div className="h-96 rounded-2xl bg-white" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[28px] font-bold leading-tight text-[#0F172A]">
          {t("work.hello", { name: user.displayName || user.email })}
        </h1>
        <div className="flex flex-wrap gap-2">
          {canCreateTask ? (
            <PrimaryButton onClick={() => setDraft(emptyTaskDraft(today))}>
              <span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> {t("work.newTask")}</span>
            </PrimaryButton>
          ) : null}
          {canCreateMeeting ? (
            <Link href="/meetings?new=1" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
              {t("quick.meeting")}
            </Link>
          ) : null}
          {canCreateEmployee ? (
            <Link href="/settings?new=employee" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
              {t("work.newEmployee")}
            </Link>
          ) : null}
        </div>
      </div>

      <WorkBoard
        tasks={tasks}
        projects={data.projects}
        employees={data.employees}
        departments={data.departments}
        team={model.team}
        today={today}
        currentUserId={user.id}
        employeeId={employeeId}
        canManage={canManage}
        canComplete={canComplete}
        canDelete={canDelete}
        busyId={busyId}
        onStatus={changeStatus}
        onAssign={changeAssignee}
        onDueDate={changeDueDate}
        onProject={changeProject}
        onFinish={completeTask}
        onDelete={deleteTask}
        onSaveTask={savePanel}
      />

      {toast ? (
        <div className="fixed bottom-24 start-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm text-white shadow-lg lg:bottom-8">
          {toast}
        </div>
      ) : null}

      {draft && business?.id ? (
        <TaskFormModal
          draft={draft}
          onChange={setDraft}
          onClose={() => { setDraft(null); setFormError(null); }}
          onSave={() => saveTask()}
          onSaved={() => {
            setDraft(null);
            setToast(t("tasks.saved"));
            void refresh();
          }}
          busy={busy}
          businessId={business.id}
          employees={data.employees}
          departments={data.departments}
          departmentCategories={data.departmentCategories}
          projects={data.projects}
          projectsError={data.projectsError}
          categoriesError={data.categoriesError}
          taskTemplates={data.taskTemplates}
          libraryTasks={data.tasks}
          canEditTeam={canEditTeam}
          canCreateProject={permissions.includes("projects.manage") || membership?.role === "BUSINESS_OWNER"}
          canCreateDepartment={permissions.includes("departments.manage") || membership?.role === "BUSINESS_OWNER"}
          canSetPrice={permissions.includes("finance.setPrice") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER"}
          vatRate={data.settings.vatRate}
          onCatalogRefresh={() => reload({ silent: true })}
          error={formError}
        />
      ) : null}
    </div>
  );
}
