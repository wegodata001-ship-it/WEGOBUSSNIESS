"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryPicker } from "@/components/admin/category-picker";
import { ActionSelect, MiniModal } from "@/components/admin/action-select";
import { ColorPicker, PriorityPicker, TaskTypePicker } from "@/components/admin/form-chips";
import { EmployeeMultiSelect } from "@/components/admin/employee-multi-select";
import { TaskLibraryPicker } from "@/components/admin/task-library-picker";
import { loadTaskFormAssets, persistTaskFormAssets, TaskFormAssets, type FormFileItem, type FormLinkItem } from "@/components/admin/task-form-assets";
import { DatePicker, Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/admin/ui";
import { mutateBusiness } from "@/lib/admin/api";
import { managedProjectCategories } from "@/lib/admin/department-categories";
import { mergeTaskLibrary, type TaskLibraryItem } from "@/lib/admin/task-library";
import { formatIls, parseMoney } from "@/lib/finance/money";
import {
  calculateEnteredPriceWithVat,
  DEFAULT_BUSINESS_VAT_RATE,
  resolveProjectBaseVatMode,
  type ProjectBaseVatMode,
} from "@/lib/finance/vat";
import { PROJECT_STATUSES, type Department, type DepartmentCategory, type Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import type { Task, TaskWriteStatus } from "@/types/task";
import type { TaskTemplate } from "@/types/task-template";
import { labelOf } from "@/lib/admin/labels";
import type { CalendarColor, TaskKind } from "@/lib/admin/palette";
import { fieldsFromParticipantIds, participantWriteFields, participantsFromFields } from "@/lib/admin/task-participants";
import { useI18n } from "@/components/providers/i18n-provider";

function enteredAmountFromTask(task: Task) {
  const mode = resolveProjectBaseVatMode(task.priceVatMode);
  if (mode === "INCLUDING_VAT") {
    return task.priceIncludingVat != null ? String(task.priceIncludingVat) : "";
  }
  return task.priceBeforeVat != null ? String(task.priceBeforeVat) : "";
}

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
  billingMode: "INCLUDED" | "BILLABLE";
  /** Entered amount; meaning depends on priceVatMode. */
  priceBeforeVat: string;
  priceVatMode: ProjectBaseVatMode;
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
    billingMode: "INCLUDED",
    priceBeforeVat: "",
    priceVatMode: "EXCLUDING_VAT",
  };
}

export function draftFromTask(task: Task, today: string): TaskDraft {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    projectId: task.projectId ?? "",
    departmentId: task.departmentId ?? "",
    ...fieldsFromParticipantIds([
      task.assigneeId,
      ...task.collaboratorIds,
      ...(task.assigneeEmployeeIds ?? []),
    ]),
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
    billingMode: task.billingMode === "BILLABLE" || task.priceIncludingVat != null ? "BILLABLE" : "INCLUDED",
    priceBeforeVat: enteredAmountFromTask(task),
    priceVatMode: resolveProjectBaseVatMode(task.priceVatMode),
  };
}

export function taskDraftPayload(draft: TaskDraft) {
  const team = participantWriteFields({
    assigneeId: draft.assigneeId,
    collaboratorIds: draft.collaboratorIds,
  });
  return {
    title: draft.title,
    description: draft.description,
    projectId: draft.projectId || null,
    departmentId: draft.departmentId || null,
    assigneeId: team.assigneeId,
    collaboratorIds: team.collaboratorIds,
    participantIds: team.participantIds,
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
    billingMode: draft.billingMode,
    ...(draft.billingMode === "BILLABLE"
      ? {
        priceVatMode: draft.priceVatMode,
        vatMode: draft.priceVatMode,
        ...(draft.priceBeforeVat.trim() ? { priceBeforeVat: Number(draft.priceBeforeVat) } : {}),
      }
      : { priceBeforeVat: null, priceVatMode: "EXCLUDING_VAT" }),
  };
}

export function TaskFormModal({
  draft,
  onChange,
  onClose,
  onSave,
  onSaved,
  busy,
  businessId,
  employees,
  departments,
  departmentCategories = [],
  projects,
  projectsError,
  categoriesError,
  taskTemplates = [],
  libraryTasks = [],
  canEditTeam,
  canCreateProject,
  canCreateDepartment,
  canSetPrice,
  vatRate = DEFAULT_BUSINESS_VAT_RATE,
  onCatalogRefresh,
  error,
}: {
  draft: TaskDraft;
  onChange: (next: TaskDraft) => void;
  onClose: () => void;
  onSave: () => Promise<{ ok: boolean; id?: string } | void> | { ok: boolean; id?: string } | void;
  onSaved?: () => void;
  busy: boolean;
  businessId: string;
  employees: Employee[];
  departments: Department[];
  departmentCategories?: DepartmentCategory[];
  projects: Project[];
  projectsError?: string | null;
  categoriesError?: string | null;
  taskTemplates?: TaskTemplate[];
  libraryTasks?: Task[];
  canEditTeam: boolean;
  canCreateProject: boolean;
  canCreateDepartment: boolean;
  canSetPrice?: boolean;
  vatRate?: number;
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
  const [files, setFiles] = useState<FormFileItem[]>([]);
  const [links, setLinks] = useState<FormLinkItem[]>([]);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetError, setAssetError] = useState("");
  const [boundTaskId, setBoundTaskId] = useState(draft.id ?? "");
  const [uploadProgress, setUploadProgress] = useState("");
  const openedTaskId = useRef(draft.id ?? "");
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const quickCategories = managedProjectCategories(departmentCategories, { includeId: quickCategory });
  const libraryItems = useMemo(() => mergeTaskLibrary(taskTemplates, libraryTasks), [libraryTasks, taskTemplates]);

  /** Always merge onto the latest draft — never spread a stale render closure. */
  function patchDraft(patch: Partial<TaskDraft>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    onChange(next);
  }

  useEffect(() => {
    if (draft.id) setBoundTaskId(draft.id);
  }, [draft.id]);

  useEffect(() => {
    if (!draft.id) return;
    if (!openedTaskId.current) {
      openedTaskId.current = draft.id;
      return;
    }
    if (openedTaskId.current !== draft.id) return;
    let active = true;
    void loadTaskFormAssets(businessId, draft.id).then((result) => {
      if (!active) return;
      setFiles(result.files);
      setLinks(result.links);
    });
    return () => {
      active = false;
    };
  }, [businessId, draft.id]);

  async function persistAssets(taskId: string) {
    setUploadProgress(t("work.uploadProgress"));
    const result = await persistTaskFormAssets({
      businessId,
      taskId,
      files,
      links,
      onFilesChange: setFiles,
    });
    setLinks([...links]);
    return result;
  }

  async function handleSave() {
    if (!draft.title.trim() || busy || assetBusy) return;
    setAssetBusy(true);
    setAssetError("");
    const result = await onSave();
    if (!result || !result.ok) {
      setAssetBusy(false);
      setUploadProgress("");
      return;
    }
    const taskId = result.id || boundTaskId || draft.id;
    if (!taskId) {
      setAssetBusy(false);
      onSaved?.();
      return;
    }
    setBoundTaskId(taskId);
    if (result.id && result.id !== draftRef.current.id) patchDraft({ id: result.id });
    const pending = files.some((item) => item.file && item.status !== "ready") || links.some((item) => !item.linkId || item.dirty);
    if (!pending) {
      setAssetBusy(false);
      setUploadProgress("");
      onSaved?.();
      return;
    }
    const persisted = await persistAssets(taskId);
    setAssetBusy(false);
    setUploadProgress("");
    if (!persisted.ok) {
      setAssetError(t("work.partialUpload"));
      return;
    }
    onSaved?.();
  }

  async function retryAssets() {
    const taskId = boundTaskId || draft.id;
    if (!taskId || assetBusy) return;
    setAssetBusy(true);
    setAssetError("");
    const persisted = await persistAssets(taskId);
    setAssetBusy(false);
    setUploadProgress("");
    if (!persisted.ok) {
      setAssetError(t("work.partialUpload"));
      return;
    }
    onSaved?.();
  }

  function applyLibraryItem(item: TaskLibraryItem) {
    patchDraft({
      title: item.title,
      description: item.description,
      taskType: item.taskType,
      departmentId: item.departmentId ?? draftRef.current.departmentId,
      templateId: item.templateId ?? "",
      saveToLibrary: false,
      freeText: false,
    });
    setReplacing(false);
  }

  function startFreeText() {
    patchDraft({
      title: "",
      description: "",
      templateId: "",
      saveToLibrary: false,
      freeText: true,
    });
    setReplacing(false);
  }

  const participants = participantsFromFields({
    assigneeId: draft.assigneeId,
    collaboratorIds: draft.collaboratorIds,
  });

  function setParticipants(ids: string[]) {
    patchDraft(fieldsFromParticipantIds(ids));
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
        patchDraft({ projectId: created.id ?? "" });
      } else {
        const created = await mutateBusiness({
          businessId,
          action: "createDepartment",
          data: { name: quickName.trim(), description: quickDescription.trim(), color: quickColor },
        });
        await onCatalogRefresh();
        patchDraft({ departmentId: created.id ?? "" });
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
            <input
              className={inputClass}
              data-testid="task-title-input"
              value={draft.title}
              onChange={(event) => patchDraft({
                title: event.target.value,
                templateId: draftRef.current.freeText ? "" : draftRef.current.templateId,
              })}
            />
          </Field>
          <Field label={t("common.date")}>
            <DatePicker
              value={draft.startDate}
              onChange={(startDate) => patchDraft({
                startDate,
                dueDate: draftRef.current.dueDate || startDate,
              })}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("work.startTime")}>
              <input className={inputClass} dir="ltr" value={draft.startTime} onChange={(event) => patchDraft({ startTime: event.target.value })} />
            </Field>
            <Field label={t("work.endTime")}>
              <input className={inputClass} dir="ltr" value={draft.endTime} onChange={(event) => patchDraft({ endTime: event.target.value })} />
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
            {!participants.length ? (
              <p className="mt-1 text-xs text-amber-700">{t("work.assignHint")}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{t("work.assignPrimary", { name: employees.find((item) => item.id === participants[0])?.displayName || participants[0] })}</p>
            )}
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("common.project")}>
              <ActionSelect
                value={draft.projectId}
                emptyLabel={t("work.pickProject")}
                options={projects.filter((item) => item.isActive || item.id === draft.projectId).map((item) => ({ id: item.id, label: item.name }))}
                actionLabel={t("work.addProject")}
                showAction={canCreateProject}
                onChange={(projectId) => patchDraft({ projectId })}
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
                onChange={(departmentId) => patchDraft({ departmentId })}
                onAction={() => openQuick("department")}
              />
            </Field>
          </div>
          <Field label={t("work.taskType")}>
            <TaskTypePicker value={draft.taskType} onChange={(taskType: TaskKind) => patchDraft({ taskType })} />
          </Field>
          <Field label={t("work.taskColor")}>
            <ColorPicker value={draft.color} onChange={(color) => patchDraft({ color })} />
          </Field>
          <Field label={t("common.priority")}>
            <PriorityPicker value={draft.priority} onChange={(priority) => patchDraft({ priority })} />
          </Field>
          {canSetPrice ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-medium text-slate-800">{t("finance.taskBilling")}</p>
              <div className="flex flex-col gap-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="task-billing-mode"
                    checked={draft.billingMode !== "BILLABLE"}
                    onChange={() => patchDraft({ billingMode: "INCLUDED", priceBeforeVat: "", priceVatMode: "EXCLUDING_VAT" })}
                  />
                  {t("finance.billingIncluded")}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="task-billing-mode"
                    checked={draft.billingMode === "BILLABLE"}
                    onChange={() => patchDraft({ billingMode: "BILLABLE" })}
                  />
                  {t("finance.billingBillable")}
                </label>
              </div>
              {draft.billingMode === "BILLABLE" ? (
                <>
                  <Field label={t("finance.taskAmount")}>
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.priceBeforeVat}
                      onChange={(event) => patchDraft({ priceBeforeVat: event.target.value })}
                      placeholder="₪"
                    />
                  </Field>
                  <div className="mt-2 flex flex-col gap-2 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="task-price-vat-mode"
                        checked={draft.priceVatMode === "INCLUDING_VAT"}
                        onChange={() => patchDraft({ priceVatMode: "INCLUDING_VAT" })}
                      />
                      {t("finance.vatModeIncluding")}
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="task-price-vat-mode"
                        checked={draft.priceVatMode === "EXCLUDING_VAT"}
                        onChange={() => patchDraft({ priceVatMode: "EXCLUDING_VAT" })}
                      />
                      {t("finance.vatModeExcluding")}
                    </label>
                  </div>
                  {(() => {
                    const parsed = parseMoney(draft.priceBeforeVat);
                    if (parsed === null || parsed < 0) return null;
                    const preview = calculateEnteredPriceWithVat(parsed, vatRate, draft.priceVatMode);
                    return (
                      <div className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-3">
                        <p>{t("finance.beforeVat")}: <span className="font-medium">{formatIls(preview.priceBeforeVat)}</span></p>
                        <p>{t("finance.vatAmount")}: <span className="font-medium">{formatIls(preview.vatAmount)}</span></p>
                        <p>{t("finance.inclVatShort")}: <span className="font-medium">{formatIls(preview.priceIncludingVat)}</span></p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{t("finance.billingIncludedHint")}</p>
              )}
            </div>
          ) : null}
          <Field label={t("common.notes")}>
            <textarea className={`${inputClass} h-24 py-2`} value={draft.description} onChange={(event) => patchDraft({ description: event.target.value })} />
          </Field>
          <TaskFormAssets
            businessId={businessId}
            taskId={boundTaskId || draft.id}
            canManage
            files={files}
            links={links}
            onFilesChange={setFiles}
            onLinksChange={setLinks}
          />
          {draft.freeText ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.saveToLibrary}
                onChange={(event) => patchDraft({ saveToLibrary: event.target.checked })}
              />
              {t("work.saveToLibrary")}
            </label>
          ) : null}
        </div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {assetError ? <p className="mt-2 text-sm text-rose-600">{assetError}</p> : null}
        {uploadProgress ? <p className="mt-2 text-sm text-slate-500">{uploadProgress}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          {assetError && (boundTaskId || draft.id) ? (
            <PrimaryButton disabled={busy || assetBusy} onClick={() => void retryAssets()}>{t("work.retryFailed")}</PrimaryButton>
          ) : (
            <PrimaryButton disabled={busy || assetBusy || !draft.title.trim()} onClick={() => void handleSave()}>
              {busy || assetBusy ? t("work.saving") : t("work.saveTask")}
            </PrimaryButton>
          )}
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
                  <CategoryPicker
                    value={quickCategory}
                    categories={quickCategories}
                    required
                    error={categoriesError ? (categoriesError === "FORBIDDEN" ? t("work.noProjectAccess") : t("work.categoriesLoadFailed")) : null}
                    onChange={setQuickCategory}
                  />
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
