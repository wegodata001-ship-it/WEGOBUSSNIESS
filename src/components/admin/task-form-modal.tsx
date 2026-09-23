"use client";

import { useState } from "react";
import { ActionSelect, MiniModal } from "@/components/admin/action-select";
import { ColorPicker, PriorityPicker, TaskTypePicker } from "@/components/admin/form-chips";
import { EmployeeMultiSelect } from "@/components/admin/employee-multi-select";
import { DatePicker, Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/admin/ui";
import { mutateBusiness } from "@/lib/admin/api";
import { PROJECT_STATUSES, type Department, type Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import type { Task, TaskWriteStatus } from "@/types/task";
import { labelOf } from "@/lib/admin/labels";
import type { CalendarColor, TaskKind } from "@/lib/admin/palette";

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
  projects,
  canEditTeam,
  canCreateProject,
  canCreateDepartment,
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
  projects: Project[];
  canEditTeam: boolean;
  canCreateProject: boolean;
  canCreateDepartment: boolean;
  onCatalogRefresh: () => Promise<void>;
  error?: string | null;
}) {
  const [quick, setQuick] = useState<"project" | "department" | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickClient, setQuickClient] = useState("");
  const [quickDescription, setQuickDescription] = useState("");
  const [quickColor, setQuickColor] = useState<CalendarColor>("BLUE");
  const [quickStatus, setQuickStatus] = useState("ACTIVE");
  const [quickError, setQuickError] = useState("");
  const [savingQuick, setSavingQuick] = useState(false);

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
      setQuickError(code === "DUPLICATE_PROJECT" || code === "DUPLICATE_DEPARTMENT" ? "שם זה כבר קיים בעסק" : "השמירה נכשלה");
    } finally {
      setSavingQuick(false);
    }
  }

  return (
    <>
      <Modal title={draft.id ? "עריכת משימה" : "משימה חדשה"} onClose={onClose}>
        <div className="grid gap-4">
          <Field label="כותרת *">
            <input className={inputClass} value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
          </Field>
          <Field label="תאריך">
            <DatePicker value={draft.startDate} onChange={(startDate) => onChange({ ...draft, startDate, dueDate: draft.dueDate || startDate })} />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="שעת התחלה">
              <input className={inputClass} dir="ltr" value={draft.startTime} onChange={(event) => onChange({ ...draft, startTime: event.target.value })} />
            </Field>
            <Field label="שעת סיום">
              <input className={inputClass} dir="ltr" value={draft.endTime} onChange={(event) => onChange({ ...draft, endTime: event.target.value })} />
            </Field>
          </div>
          <Field label="משתתפים">
            <EmployeeMultiSelect
              employees={employees}
              departments={departments}
              value={participants}
              disabled={Boolean(draft.id) && !canEditTeam}
              placeholder="חפש והוסף עובד..."
              onChange={setParticipants}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="פרויקט">
              <ActionSelect
                value={draft.projectId}
                emptyLabel="בחר פרויקט"
                options={projects.filter((item) => item.isActive || item.id === draft.projectId).map((item) => ({ id: item.id, label: item.name }))}
                actionLabel="הוספת פרויקט חדש"
                showAction={canCreateProject}
                onChange={(projectId) => onChange({ ...draft, projectId })}
                onAction={() => openQuick("project")}
              />
            </Field>
            <Field label="מחלקה">
              <ActionSelect
                value={draft.departmentId}
                emptyLabel="בחר מחלקה"
                options={departments.filter((item) => item.isActive || item.id === draft.departmentId).map((item) => ({ id: item.id, label: item.name }))}
                actionLabel="הוספת מחלקה חדשה"
                showAction={canCreateDepartment}
                onChange={(departmentId) => onChange({ ...draft, departmentId })}
                onAction={() => openQuick("department")}
              />
            </Field>
          </div>
          <Field label="סוג משימה">
            <TaskTypePicker value={draft.taskType} onChange={(taskType: TaskKind) => onChange({ ...draft, taskType })} />
          </Field>
          <Field label="צבע משימה">
            <ColorPicker value={draft.color} onChange={(color) => onChange({ ...draft, color })} />
          </Field>
          <Field label="עדיפות">
            <PriorityPicker value={draft.priority} onChange={(priority) => onChange({ ...draft, priority })} />
          </Field>
          <Field label="תיאור / הערות">
            <textarea className={`${inputClass} h-24 py-2`} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
          </Field>
        </div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <GhostButton onClick={onClose}>ביטול</GhostButton>
          <PrimaryButton disabled={busy || !draft.title.trim()} onClick={onSave}>{busy ? "שומר…" : "שמירת משימה"}</PrimaryButton>
        </div>
      </Modal>

      {quick ? (
        <MiniModal title={quick === "project" ? "הוספת פרויקט חדש" : "מחלקה חדשה"} onClose={() => setQuick(null)}>
          <div className="space-y-3">
            <Field label={quick === "project" ? "שם הפרויקט *" : "שם מחלקה *"}>
              <input className={inputClass} value={quickName} onChange={(event) => setQuickName(event.target.value)} />
            </Field>
            {quick === "project" ? (
              <>
                <Field label="לקוח">
                  <input className={inputClass} value={quickClient} onChange={(event) => setQuickClient(event.target.value)} />
                </Field>
                <Field label="סטטוס">
                  <select className={inputClass} value={quickStatus} onChange={(event) => setQuickStatus(event.target.value)}>
                    {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
                  </select>
                </Field>
              </>
            ) : null}
            <Field label="תיאור">
              <textarea className={`${inputClass} h-20 py-2`} value={quickDescription} onChange={(event) => setQuickDescription(event.target.value)} />
            </Field>
            <Field label="צבע">
              <ColorPicker value={quickColor} onChange={setQuickColor} />
            </Field>
            {quickError ? <p className="text-sm text-red-600">{quickError}</p> : null}
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setQuick(null)}>ביטול</GhostButton>
              <PrimaryButton disabled={savingQuick || !quickName.trim()} onClick={() => void saveQuick()}>
                {quick === "project" ? "שמירת פרויקט" : "שמירת מחלקה"}
              </PrimaryButton>
            </div>
          </div>
        </MiniModal>
      ) : null}
    </>
  );
}
