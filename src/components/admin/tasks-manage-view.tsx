"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { CollaboratorAvatars } from "@/components/admin/employee-multi-select";
import { TaskFormModal, draftFromTask, emptyTaskDraft, taskDraftPayload, type TaskDraft } from "@/components/admin/task-form-modal";
import { GhostButton, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { TaskDetailDrawer } from "@/components/tasks/task-detail-drawer";
import { TaskWorkCard } from "@/components/tasks/task-work-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { mutateBusiness, saveBusinessTask, taskMutationMessage } from "@/lib/admin/api";
import { departmentName, employeeName, projectName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { isEmployeeOnTask, taskParticipantIds } from "@/lib/admin/task-team";
import { daysBetween, isArchivedTaskStatus, isOverdue } from "@/lib/admin/time";
import { todayInTimeZone } from "@/lib/dates/format";
import { startTask, finishTask } from "@/lib/tasks/actions";
import { isPendingApproval, TASK_PRIORITIES, type Task } from "@/types/task";

type TabId = "all" | "mine" | "shared" | "approval" | "progress" | "overdue" | "done";

export function TasksManageView() {
  const { t } = useI18n();
  const { user, business, membership, permissions } = useBusinessContext();
  const membershipEmployeeId = membership?.employeeId ?? null;
  const canManage = permissions.includes("tasks.edit") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [departmentId, setDepartmentId] = useState(searchParams.get("departmentId") ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueFilter] = useState(searchParams.get("filter") ?? "");
  const [tab, setTab] = useState<TabId>(searchParams.get("tab") as TabId || (searchParams.get("filter") === "overdue" ? "overdue" : canManage ? "all" : "mine"));
  const [draft, setDraft] = useState<TaskDraft | null>(searchParams.get("new") === "1" ? emptyTaskDraft(today) : null);
  const [details, setDetails] = useState<Task | null>(null);
  const [openChat, setOpenChat] = useState(searchParams.get("chat") === "1");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const id = searchParams.get("taskId");
    if (!id || !data.tasks.length) return;
    const found = data.tasks.find((task) => task.id === id);
    if (found) setDetails(found);
  }, [data.tasks, searchParams]);

  const pendingCount = data.tasks.filter((task) => isPendingApproval(task.status)).length;

  const rows = useMemo(() => {
    return data.tasks.filter((task) => {
      const mine = isEmployeeOnTask(task, membershipEmployeeId) || task.createdByUserId === user.id;
      const shared = taskParticipantIds(task).length > 1;
      if (tab === "mine" && !mine) return false;
      if (tab === "shared" && !shared) return false;
      if (tab === "approval" && !isPendingApproval(task.status)) return false;
      if (tab === "progress" && task.status !== "IN_PROGRESS") return false;
      if (tab === "overdue" && !isOverdue(task, today)) return false;
      if (tab === "done" && task.status !== "COMPLETED" && task.status !== "DONE") return false;
      if (tab === "all" && isPendingApproval(task.status) && !canManage) return false;
      if (tab !== "approval" && tab !== "all" && isPendingApproval(task.status) && task.createdByUserId !== user.id) return false;
      if (!canManage && tab !== "approval" && isArchivedTaskStatus(task.status)) return false;
      if (query && !task.title.includes(query) && !task.description.includes(query)) return false;
      if (status && task.status !== status) return false;
      if (priority && task.priority !== priority) return false;
      if (departmentId && task.departmentId !== departmentId) return false;
      if (employeeId && !isEmployeeOnTask(task, employeeId)) return false;
      if (projectId && task.projectId !== projectId) return false;
      if (dueFilter === "overdue" && !isOverdue(task, today)) return false;
      if (dueFilter === "dueToday" && task.dueDate !== today) return false;
      return true;
    });
  }, [canManage, data.tasks, departmentId, dueFilter, employeeId, membershipEmployeeId, priority, projectId, query, status, tab, today, user.id]);

  if (loading) return <Spinner label="טוען משימות…" />;

  async function save() {
    if (!business?.id || !draft?.title.trim()) return;
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
      return;
    }
    setDraft(null);
    setToast(canManage ? t("tasks.saved") : "המשימה נשלחה לאישור מנהל");
    await reload({ silent: true });
  }

  async function run(action: string, task: Task, extra?: Record<string, unknown>) {
    if (!business?.id) return;
    setBusy(true);
    try {
      if (action === "start") await startTask(business.id, task.id);
      else if (action === "finish") await finishTask(business.id, task.id);
      else await mutateBusiness({ businessId: business.id, action, id: task.id, data: extra });
      await reload({ silent: true });
    } catch (error) {
      const code = error instanceof Error ? error.message : "NETWORK";
      setToast(code === "FORBIDDEN" ? t("tasks.forbidden") : t("tasks.network"));
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: TabId; label: string; hidden?: boolean; badge?: number }> = canManage
    ? [
      { id: "all", label: "כל המשימות" },
      { id: "mine", label: "המשימות שלי" },
      { id: "approval", label: "ממתינות לאישור", badge: pendingCount },
      { id: "progress", label: "בביצוע" },
      { id: "overdue", label: "באיחור" },
      { id: "done", label: "הושלמו" },
    ]
    : [
      { id: "mine", label: "המשימות שלי" },
      { id: "shared", label: "משימות משותפות" },
      { id: "approval", label: "ממתינות לאישור" },
      { id: "done", label: "הושלמו" },
    ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={canManage ? "מרכז בקרת משימות" : "המשימות שלי"}
        subtitle={canManage ? "יצירה, אישור ומעקב אחר משימות העסק" : "משימות שהוקצו לך ומשימות שהגשת לאישור"}
        actions={<PrimaryButton onClick={() => setDraft(emptyTaskDraft(today))}>+ משימה חדשה</PrimaryButton>}
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm ${tab === item.id ? "bg-[#0F172A] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {item.label}
            {item.badge ? <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-amber-950">{item.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-4 xl:grid-cols-6">
        <input className={inputClass} placeholder="חיפוש" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">עדיפות</option>
          {TASK_PRIORITIES.filter((item) => item !== "MEDIUM").map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
        </select>
        <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          <option value="">מחלקה</option>
          {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {canManage ? (
          <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">עובד</option>
            {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
        ) : null}
        <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">פרויקט</option>
          {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">סטטוס</option>
          {["PENDING_APPROVAL", "TODO", "IN_PROGRESS", "WAITING", "COMPLETED", "REJECTED", "ARCHIVED"].map((item) => (
            <option key={item} value={item}>{labelOf(item)}</option>
          ))}
        </select>
      </div>

      {rows.length ? (
        <>
          <div className="grid gap-3 md:hidden">
            {rows.map((task) => (
              <TaskWorkCard
                key={task.id}
                task={task}
                employees={data.employees}
                today={today}
                onOpen={() => { setDetails(task); setOpenChat(false); }}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-start text-xs text-slate-500">
                <tr>
                  {["משימה", "משתתפים", "מחלקה", "זמן", "עדיפות", "סטטוס", "פעולות"].map((item) => (
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
                        <button type="button" className="text-start" onClick={() => { setDetails(task); setOpenChat(false); }}>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-slate-500">{projectName(data.projects, task.projectId)}</p>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span>{employeeName(data.employees, task.assigneeId)}</span>
                          <CollaboratorAvatars employees={data.employees} ids={task.collaboratorIds} />
                        </div>
                      </td>
                      <td className="px-3 py-3">{departmentName(data.departments, task.departmentId)}</td>
                      <td className="px-3 py-3">{task.startTime ? `${task.startTime}${task.endTime ? `–${task.endTime}` : ""}` : task.dueDate ?? "—"}{left !== null ? ` · ${left}י` : ""}</td>
                      <td className="px-3 py-3"><StatusBadge value={task.priority} label={labelOf(task.priority)} /></td>
                      <td className="px-3 py-3">
                        <StatusBadge value={isOverdue(task, today) ? "OVERDUE" : task.status} label={labelOf(isOverdue(task, today) ? "OVERDUE" : task.status)} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <GhostButton onClick={() => { setDetails(task); setOpenChat(false); }}>פרטים</GhostButton>
                          {canManage || task.createdByUserId === user.id ? (
                            <GhostButton onClick={() => setDraft(draftFromTask(task, today))}>עריכה</GhostButton>
                          ) : null}
                          {canManage && !isPendingApproval(task.status) ? (
                            <>
                              <GhostButton disabled={busy} onClick={() => void run("start", task)}>התחלה</GhostButton>
                              <GhostButton disabled={busy} onClick={() => void run("finish", task)}>סיום</GhostButton>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState icon={ClipboardList} title="אין משימות להצגה" action={<PrimaryButton onClick={() => setDraft(emptyTaskDraft(today))}>+ יצירת משימה</PrimaryButton>} />
      )}

      {toast ? (
        <div className="fixed bottom-24 start-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm text-white shadow-lg lg:bottom-8">
          {toast}
        </div>
      ) : null}

      {details && business?.id ? (
        <TaskDetailDrawer
          task={data.tasks.find((item) => item.id === details.id) ?? details}
          employees={data.employees}
          departments={data.departments}
          projects={data.projects}
          canManage={canManage}
          canChat
          businessId={business.id}
          currentEmployeeId={membershipEmployeeId}
          openChat={openChat}
          onClose={() => { setDetails(null); setOpenChat(false); }}
          onChanged={() => void reload({ silent: true })}
        />
      ) : null}

      {draft && business?.id ? (
        <TaskFormModal
          draft={draft}
          onChange={setDraft}
          onClose={() => { setDraft(null); setFormError(null); }}
          onSave={() => void save()}
          busy={busy}
          businessId={business.id}
          employees={data.employees}
          departments={data.departments}
          projects={data.projects}
          canEditTeam={canManage}
          canCreateProject={permissions.includes("projects.manage") || membership?.role === "BUSINESS_OWNER"}
          canCreateDepartment={permissions.includes("departments.manage") || membership?.role === "BUSINESS_OWNER"}
          onCatalogRefresh={() => reload({ silent: true })}
          error={formError}
        />
      ) : null}
    </div>
  );
}
