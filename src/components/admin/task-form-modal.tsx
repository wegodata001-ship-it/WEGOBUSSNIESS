"use client";

import { useMemo, useState } from "react";
import { ActionSelect, MiniModal } from "@/components/admin/action-select";
import { ColorPicker, PriorityPicker, TaskTypePicker } from "@/components/admin/form-chips";
import { EmployeeMultiSelect } from "@/components/admin/employee-multi-select";
import { TaskLibraryPicker } from "@/components/admin/task-library-picker";
import { DatePicker, Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/admin/ui";
import { mutateBusiness } from "@/lib/admin/api";
import { categoriesForDepartment } from "@/lib/admin/department-categories";
import { mergeTaskLibrary, type TaskLibraryItem } from "@/lib/admin/task-library";
import { PROJECT_STATUSES, type Department, type DepartmentCategory, type Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import type { Task, TaskWriteStatus } from "@/types/task";
import type { TaskTemplate } from "@/types/task-template";
import { labelOf } from "@/lib/admin/labels";
import type { CalendarColor, TaskKind } from "@/lib/admin/palette";
import { useI18n } from "@/components/providers/i18n-provider";

export type TaskDraft = {
  id?: string;
  title: string;
  description: string;
  projectId: string;
  departmentId: string;
  assigneeId: string;
  collaboratorIds: string[];
  startDate: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  estimatedHours: string;
  priority: string;
  color: string;
  taskType: string;
  status: TaskWriteStatus;
  templateId: string;
  saveToLibrary: boolean;
  freeText: boolean;
  priceBeforeVat: string;
};

export function emptyTaskDraft(today: string, startTime = "09:00", endTime = "10:00"): TaskDraft {
  return {
    title: "",
    description: "",
    projectId: "",
    departmentId: "",
    assigneeId: "",
    collaboratorIds: [],
    startDate: today,
    dueDate: today,
    startTime,
    endTime,
    estimatedHours: "",
    priority: "NORMAL",
    color: "BLUE",
    taskType: "GENERAL",
    status: "TODO",
    templateId: "",
    saveToLibrary: false,
    freeText: false,
    priceBeforeVat: "",
  };
}

export function draftFromTask(task: Task, today: string): TaskDraft {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    projectId: task.projectId ?? "",
    departmentId: task.departmentId ?? "",
    assigneeId: task.assigneeId ?? "",
    collaboratorIds: task.collaboratorIds.filter((id) => id !== task.assigneeId),
    startDate: task.startDate ?? task.scheduledDate ?? today,
    dueDate: task.dueDate ?? today,
    startTime: task.startTime ?? "09:00",
    endTime: task.endTime ?? "10:00",
    estimatedHours: task.estimatedHours?.toString() ?? "",
    priority: task.priority === "MEDIUM" ? "NORMAL" : task.priority,
    color: task.color || "BLUE",
    taskType: task.taskType || "GENERAL",
    status: task.status === "IN_PROGRESS" || task.status === "WAITING" || task.status === "DONE" || task.status === "ARCHIVED" ? task.status : "TODO",
    templateId: task.templateId ?? "",
    saveToLibrary: false,
    freeText: false,
    priceBeforeVat: task.priceBeforeVat != null ? String(task.priceBeforeVat) : "",
  };
}

export function taskDraftPayload(draft: TaskDraft) {
  const participantIds = [draft.assigneeId, ...draft.collaboratorIds].filter(Boolean);
  return {
    title: draft.title,
    description: draft.description,
    projectId: draft.projectId || null,
    departmentId: draft.departmentId || null,
    assigneeId: draft.assigneeId || null,
    collaboratorIds: draft.collaboratorIds.filter((id) => id && id !== draft.assigneeId),
    participantIds,
    estimatedHours: draft.estimatedHours ? Number(draft.estimatedHours) : null,
    startDate: draft.startDate,
    dueDate: draft.dueDate,
    scheduledDate: draft.startDate,
    startTime: draft.startTime,
    endTime: draft.endTime,
    color: draft.color || "BLUE",
    taskType: draft.taskType || "GENERAL",
    priority: draft.priority,
    status: draft.status,
    templateId: draft.templateId || null,
    saveToLibrary: draft.saveToLibrary,
    ...(draft.priceBeforeVat.trim() ? { priceBeforeVat: Number(draft.priceBeforeVat) } : {}),
  };
}

export function TaskFormModal({
  draft,
  onChange,
  onClose,
  onSave,
  busy,
  businessId,
  employees,
  departments,
  departmentCategories = [],
  projects,
  projectsError,
  taskTemplates = [],
  libraryTasks = [],
  canEditTeam,
  canCreateProject,
  canCreateDepartment,
  canSetPrice,
  onCatalogRefresh,
  error,
}: {
  draft: TaskDraft;
  onChange: (next: TaskDraft) => void;
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
  businessId: string;
  employees: Employee[];
  departments: Department[];
  departmentCategories?: DepartmentCategory[];
  projects: Project[];
  projectsError?: string | null;
  taskTemplates?: TaskTemplate[];
  libraryTasks?: Task[];
  canEditTeam: boolean;
  canCreateProject: boolean;
  canCreateDepartment: boolean;
  canSetPrice?: boolean;
  onCatalogRefresh: () => Promise<void>;
  error?: string | null;
}) {
  const { t } = useI18n();
  const [quick, setQuick] = useState<"project" | "department" | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickClient, setQuickClient] = useState("");
  const [quickDescription, setQuickDescription] = useState("");
  const [quickColor, setQuickColor] = useState<CalendarColor>("BLUE");
  const [quickStatus, setQuickStatus] = useState("ACTIVE");
  const [quickDepartmentId, setQuickDepartmentId] = useState("");
  const [quickCategory, setQuickCategory] = useState("");
  const [quickError, setQuickError] = useState("");
  const [savingQuick, setSavingQuick] = useState(false);
  const [replacing, setReplacing] = useState(!draft.id);
  const quickCategories = categoriesForDepartment(departmentCategories, quickDepartmentId);
  const libraryItems = useMemo(() => mergeTaskLibrary(taskTemplates, libraryTasks), [libraryTasks, taskTemplates]);

  function applyLibraryItem(item: TaskLibraryItem) {
    onChange({
      ...draft,
      title: item.title,
      description: item.description,
      taskType: item.taskType,
      departmentId: item.departmentId ?? draft.departmentId,
      templateId: item.templateId ?? "",
      saveToLibrary: false,
      freeText: false,
    });
    setReplacing(false);
  }

  function startFreeText() {
    onChange({
      ...draft,
      title: "",
      description: "",
      templateId: "",
      saveToLibrary: false,
      freeText: true,
    });
    setReplacing(false);
  }

  const participants = [draft.assigneeId, ...draft.collaboratorIds].filter(Boolean);

  function setParticipants(ids: string[]) {
    onChange({
      ...draft,
      assigneeId: ids[0] ?? "",
      collaboratorIds: ids.slice(1),
    });
  }

  function openQuick(kind: "project" | "department") {
    setQuickError("");
    setQuickName("");
    setQuickClient("");
    setQuickDescription("");
    setQuickColor("BLUE");
    setQuickStatus("ACTIVE");
    setQuickDepartmentId("");
    setQuickCategory("");
    setQuick(kind);
  }

  async function saveQuick() {
    if (!quickName.trim()) return;
    setSavingQuick(true);
    setQuickError("");
    try {
      if (quick === "project") {
        const created = await mutateBusiness({
          businessId,
          action: "createProject",
          data: {
            name: quickName.trim(),
            clientName: quickClient.trim(),
            description: quickDescription.trim(),
            departmentId: quickDepartmentId,
            categoryId: quickCategory,
            color: quickColor,
            status: quickStatus,
          },
        });
        await onCatalogRefresh();
        onChange({ ...draft, projectId: created.id ?? "" });
      } else {
        const created = await mutateBusiness({
          businessId,
          action: "createDepartment",
          data: { name: quickName.trim(), description: quickDescription.trim(), color: quickColor },
        });
        await onCatalogRefresh();
        onChange({ ...draft, departmentId: created.id ?? "" });
      }
      setQuick(null);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setQuickError(code === "DUPLICATE_PROJECT" || code === "DUPLICATE_DEPARTMENT" ? t("work.duplicateName") : t("work.saveFailed"));
    } finally {
      setSavingQuick(false);
    }
  }

  return (
    <>
      <Modal title={draft.id ? t("work.editTask") : t("work.newTaskFull")} onClose={onClose}>
        <div className="grid gap-4">
          {!replacing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">{t("work.currentTask")}: <span className="font-medium text-slate-900">{draft.title || "—"}</span></p>
              <GhostButton onClick={() => setReplacing(true)}>{t("work.replaceTask")}</GhostButton>
            </div>
          ) : (
            <TaskLibraryPicker
              items={libraryItems}
              departments={departments}
              onSelect={applyLibraryItem}
              onFreeText={startFreeText}
            />
          )}
          <Field label={`${t("docs.taskName")} *`}>
            <input className={inputClass} value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value, templateId: draft.freeText ? "" : draft.templateId })} />
          </Field>
          <Field label={t("common.date")}>
            <DatePicker value={draft.startDate} onChange={(startDate) => onChange({ ...draft, startDate, dueDate: draft.dueDate || startDate })} />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("work.startTime")}>
              <input className={inputClass} dir="ltr" value={draft.startTime} onChange={(event) => onChange({ ...draft, startTime: event.target.value })} />
            </Field>
            <Field label={t("work.endTime")}>
              <input className={inputClass} dir="ltr" value={draft.endTime} onChange={(event) => onChange({ ...draft, endTime: event.target.value })} />
            </Field>
          </div>
          <Field label={t("work.participants")}>
            <EmployeeMultiSelect
              employees={employees}
              departments={departments}
              value={participants}
              disabled={Boolean(draft.id) && !canEditTeam}
              placeholder={t("work.searchEmployee")}
              onChange={setParticipants}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("common.project")}>
              <ActionSelect
                value={draft.projectId}
                emptyLabel={t("work.pickProject")}
                options={projects.filter((item) => item.isActive || item.id === draft.projectId).map((item) => ({ id: item.id, label: item.name }))}
                actionLabel={t("work.addProject")}
                showAction={canCreateProject}
                onChange={(projectId) => onChange({ ...draft, projectId })}
                onAction={() => openQuick("project")}
              />
              {projectsError ? (
                <p className="mt-1 text-sm text-red-600">
                  {projectsError === "FORBIDDEN" ? t("work.noProjectAccess") : t("work.projectsLoadFailed")}
                </p>
              ) : !projects.some((item) => item.isActive || item.id === draft.projectId) ? (
                <p className="mt-1 text-sm text-slate-500">{t("work.noProjectsAvailable")}</p>
              ) : null}
            </Field>
            <Field label={t("common.department")}>
              <ActionSelect
                value={draft.departmentId}
                emptyLabel={t("work.pickDepartment")}
                options={departments.filter((item) => item.isActive || item.id === draft.departmentId).map((item) => ({ id: item.id, label: item.name }))}
                actionLabel={t("work.addDepartment")}
                showAction={canCreateDepartment}
                onChange={(departmentId) => onChange({ ...draft, departmentId })}
                onAction={() => openQuick("department")}
              />
            </Field>
          </div>
          <Field label={t("work.taskType")}>
            <TaskTypePicker value={draft.taskType} onChange={(taskType: TaskKind) => onChange({ ...draft, taskType })} />
          </Field>
          <Field label={t("work.taskColor")}>
            <ColorPicker value={draft.color} onChange={(color) => onChange({ ...draft, color })} />
          </Field>
          <Field label={t("common.priority")}>
            <PriorityPicker value={draft.priority} onChange={(priority) => onChange({ ...draft, priority })} />
          </Field>
          {canSetPrice ? (
            <Field label={t("work.priceOptional")}>
              <input className={inputClass} inputMode="decimal" value={draft.priceBeforeVat} onChange={(event) => onChange({ ...draft, priceBeforeVat: event.target.value })} placeholder="₪" />
            </Field>
          ) : null}
          <Field label={t("common.notes")}>
            <textarea className={`${inputClass} h-24 py-2`} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
          </Field>
          {draft.freeText ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.saveToLibrary}
                onChange={(event) => onChange({ ...draft, saveToLibrary: event.target.checked })}
              />
              {t("work.saveToLibrary")}
            </label>
          ) : null}
        </div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <PrimaryButton disabled={busy || !draft.title.trim()} onClick={onSave}>{busy ? t("work.saving") : t("work.saveTask")}</PrimaryButton>
        </div>
      </Modal>

      {quick ? (
        <MiniModal title={quick === "project" ? t("work.addProject") : t("settings.newDepartment")} onClose={() => setQuick(null)}>
          <div className="space-y-3">
            <Field label={quick === "project" ? t("work.projectName") : t("work.departmentNameRequired")}>
              <input className={inputClass} value={quickName} onChange={(event) => setQuickName(event.target.value)} />
            </Field>
            {quick === "project" ? (
              <>
                <Field label={t("common.client")}>
                  <input className={inputClass} value={quickClient} onChange={(event) => setQuickClient(event.target.value)} />
                </Field>
                <Field label={t("common.department")}>
                  <select
                    className={inputClass}
                    value={quickDepartmentId}
                    onChange={(event) => {
                      setQuickDepartmentId(event.target.value);
                      setQuickCategory("");
                    }}
                  >
                    <option value="">{t("settings.pickDepartment")}</option>
                    {departments.filter((item) => item.isActive).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label={`${t("common.category")} *`}>
                  <select className={inputClass} value={quickCategory} onChange={(event) => setQuickCategory(event.target.value)} disabled={!quickDepartmentId}>
                    <option value="">{quickDepartmentId ? t("work.pickCategory") : t("work.pickDepartmentFirst")}</option>
                    {quickCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label={t("common.status")}>
                  <select className={inputClass} value={quickStatus} onChange={(event) => setQuickStatus(event.target.value)}>
                    {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
                  </select>
                </Field>
              </>
            ) : null}
            <Field label={t("common.description")}>
              <textarea className={`${inputClass} h-20 py-2`} value={quickDescription} onChange={(event) => setQuickDescription(event.target.value)} />
            </Field>
            <Field label={t("common.color")}>
              <ColorPicker value={quickColor} onChange={setQuickColor} />
            </Field>
            {quickError ? <p className="text-sm text-red-600">{quickError}</p> : null}
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setQuick(null)}>{t("common.cancel")}</GhostButton>
              <PrimaryButton disabled={savingQuick || !quickName.trim() || (quick === "project" && !quickCategory)} onClick={() => void saveQuick()}>
                {quick === "project" ? t("work.saveProject") : t("work.saveDepartment")}
              </PrimaryButton>
            </div>
          </div>
        </MiniModal>
      ) : null}
    </>
  );
}
