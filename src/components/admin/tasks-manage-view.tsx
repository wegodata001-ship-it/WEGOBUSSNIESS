"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { CollaboratorAvatars } from "@/components/admin/employee-multi-select";
import { TaskFormModal, draftFromTask, emptyTaskDraft, type TaskDraft } from "@/components/admin/task-form-modal";
import { GhostButton, Modal, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { mutateBusiness } from "@/lib/admin/api";
import { departmentName, employeeName, projectName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { isEmployeeOnTask } from "@/lib/admin/task-team";
import { actualHoursForTask, daysBetween, isArchivedTaskStatus, isOverdue } from "@/lib/admin/time";
import { todayInTimeZone } from "@/lib/dates/format";
import { startTask, finishTask } from "@/lib/tasks/actions";
import { TASK_WRITE_STATUSES, type Task } from "@/types/task";
import { TASK_PRIORITIES } from "@/types/task";

const emptyDraft = emptyTaskDraft;

export function TasksManageView() {
  const { business, membership, permissions } = useBusinessContext();
  const membershipEmployeeId = membership?.employeeId ?? null;
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [details, setDetails] = useState<Task | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const canEditTeam =
    permissions.includes("tasks.edit")
    || membership?.role === "BUSINESS_OWNER"
    || membership?.role === "MANAGER";
  const canCreateProject = permissions.includes("projects.manage") || membership?.role === "BUSINESS_OWNER";
  const canCreateDepartment = permissions.includes("departments.manage") || membership?.role === "BUSINESS_OWNER";

  const rows = useMemo(() => {
    return data.tasks.filter((task) => {
      if (!showArchive && isArchivedTaskStatus(task.status)) return false;
      if (query && !task.title.includes(query) && !task.description.includes(query)) return false;
      if (status && task.status !== status && !(status === "TODO" && (task.status === "OPEN" || task.status === "PENDING"))) return false;
      if (priority && task.priority !== priority) return false;
      if (departmentId && task.departmentId !== departmentId) return false;
      if (employeeId && !isEmployeeOnTask(task, employeeId)) return false;
      if (mineOnly && !isEmployeeOnTask(task, membershipEmployeeId)) return false;
      if (projectId && task.projectId !== projectId) return false;
      return true;
    });
  }, [data.tasks, departmentId, employeeId, membershipEmployeeId, mineOnly, priority, projectId, query, showArchive, status]);

  if (loading) return <Spinner label="טוען משימות…" />;

  async function save() {
    if (!business?.id || !draft?.title.trim()) return;
    setBusy(true);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: draft.id ? "updateTask" : "createTask",
        id: draft.id,
        data: {
          ...draft,
          assigneeId: draft.assigneeId || null,
          collaboratorIds: draft.collaboratorIds.filter((id) => id && id !== draft.assigneeId),
          estimatedHours: draft.estimatedHours ? Number(draft.estimatedHours) : null,
          startTime: draft.startTime,
          endTime: draft.endTime,
          color: draft.color || "BLUE",
          taskType: draft.taskType || "GENERAL",
        },
      });
      setDraft(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function run(action: string, task: Task, extra?: Record<string, unknown>) {
    if (!business?.id) return;
    setBusy(true);
    try {
      if (action === "start") await startTask(business.id, task.id);
      else if (action === "finish") await finishTask(business.id, task.id);
      else await mutateBusiness({ businessId: business.id, action, id: task.id, data: extra });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="ניהול משימות"
        subtitle="יצירה, מעקב, התחלה וסיום של כל משימות העסק"
        actions={<PrimaryButton onClick={() => setDraft(emptyDraft(today))}>+ משימה חדשה</PrimaryButton>}
      />

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-4 xl:grid-cols-7">
        <input className={inputClass} placeholder="חיפוש" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">סטטוס</option>
          {TASK_WRITE_STATUSES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
        </select>
        <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">עדיפות</option>
          {TASK_PRIORITIES.filter((item) => item !== "MEDIUM").map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
        </select>
        <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          <option value="">מחלקה</option>
          {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          <option value="">עובד</option>
          {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
        </select>
        <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">פרויקט</option>
          {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showArchive} onChange={(event) => setShowArchive(event.target.checked)} />
          הצג ארכיון
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2">
          <input type="checkbox" checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} />
          המשימות שלי
        </label>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-start text-xs text-slate-500">
              <tr>
                {["משימה / פרויקט", "אחראי", "מחלקה", "התחלה", "Deadline", "ימים", "מכסה", "בפועל", "עדיפות", "סטטוס", "פעולות"].map((item) => (
                  <th key={item} className="px-3 py-3 font-medium">{item}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => {
                const left = task.dueDate ? daysBetween(today, task.dueDate) : null;
                return (
                  <tr key={task.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <button type="button" className="text-start" onClick={() => setDetails(task)}>
                        <p className="flex items-center gap-2 font-medium">
                          <span className={`h-2.5 w-2.5 rounded-full ${task.color === "GREEN" ? "bg-emerald-500" : task.color === "PURPLE" ? "bg-violet-500" : task.color === "ORANGE" ? "bg-orange-500" : task.color === "RED" ? "bg-rose-500" : task.color === "PINK" ? "bg-pink-500" : task.color === "YELLOW" ? "bg-amber-400" : task.color === "CYAN" ? "bg-cyan-500" : "bg-sky-500"}`} />
                          {task.title}
                        </p>
                        <p className="text-xs text-slate-500">{projectName(data.projects, task.projectId)}</p>
                      </button>
                      {task.collaboratorIds.length ? (
                        <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">משימה משותפת</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span>{employeeName(data.employees, task.assigneeId)}</span>
                        <CollaboratorAvatars employees={data.employees} ids={task.collaboratorIds} />
                      </div>
                    </td>
                    <td className="px-3 py-3">{departmentName(data.departments, task.departmentId)}</td>
                    <td className="px-3 py-3">{task.startDate ?? "—"}</td>
                    <td className="px-3 py-3">{task.dueDate ?? "—"}</td>
                    <td className="px-3 py-3">{left === null ? "—" : left}</td>
                    <td className="px-3 py-3">{task.estimatedHours ?? "—"}</td>
                    <td className="px-3 py-3">{actualHoursForTask(data.sessions, task.id)}</td>
                    <td className="px-3 py-3"><StatusBadge value={task.priority} label={labelOf(task.priority)} /></td>
                    <td className="px-3 py-3">
                      <StatusBadge value={isOverdue(task, today) ? "OVERDUE" : task.status} label={labelOf(isOverdue(task, today) ? "OVERDUE" : task.status)} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <GhostButton onClick={() => setDetails(task)}>צפייה</GhostButton>
                        <GhostButton onClick={() => setDraft(draftFromTask(task, today))}>עריכה</GhostButton>
                        <GhostButton disabled={busy} onClick={() => void run("start", task)}>התחלה</GhostButton>
                        <GhostButton disabled={busy} onClick={() => void run("finish", task)}>סיום</GhostButton>
                        <GhostButton disabled={busy} onClick={() => void run("changeTaskStatus", task, { status: "WAITING" })}>המתנה</GhostButton>
                        <GhostButton disabled={busy} onClick={() => void run("archiveTask", task)}>ארכיון</GhostButton>
                        {permissions.includes("tasks.delete") ? (
                          <GhostButton disabled={busy} onClick={() => void run("deleteTask", task)}>מחיקה</GhostButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={ClipboardList} title="אין משימות פעילות כרגע" action={<PrimaryButton onClick={() => setDraft(emptyDraft(today))}>+ יצירת משימה</PrimaryButton>} />
      )}

      {details ? (
        <Modal title="פרטי משימה" onClose={() => setDetails(null)}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-lg font-semibold">{details.title}</p>
              {details.collaboratorIds.length ? <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">משימה משותפת</span> : null}
            </div>
            <p className="leading-6 text-slate-600">{details.description || "אין תיאור"}</p>
            <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-semibold">צוות המשימה</h3>
              <p><span className="text-slate-500">אחראי ראשי: </span>{employeeName(data.employees, details.assigneeId)}</p>
              <div className="mt-2">
                <p className="text-slate-500">עובדים משותפים:</p>
                {details.collaboratorIds.length ? (
                  <ul className="mt-1 space-y-1">
                    {details.collaboratorIds.map((id) => <li key={id}>{employeeName(data.employees, id)}</li>)}
                  </ul>
                ) : <p className="mt-1">אין עובדים משותפים</p>}
              </div>
            </section>
          </div>
        </Modal>
      ) : null}

      {draft && business?.id ? (
        <TaskFormModal
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={() => void save()}
          busy={busy}
          businessId={business.id}
          employees={data.employees}
          departments={data.departments}
          projects={data.projects}
          canEditTeam={canEditTeam}
          canCreateProject={canCreateProject}
          canCreateDepartment={canCreateDepartment}
          onCatalogRefresh={() => reload({ silent: true })}
        />
      ) : null}
    </div>
  );
}
