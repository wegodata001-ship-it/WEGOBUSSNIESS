"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, MoreHorizontal, Search } from "lucide-react";
import { WorkTaskPanel, draftFromWorkTask, progressFromStatus, statusFromProgress, type WorkTaskDraft } from "@/components/admin/work-task-panel";
import { employeeName, projectName } from "@/lib/admin/catalog";
import { categoryStyles } from "@/lib/admin/category-color";
import { type TeamNowRow, type TeamPresence } from "@/lib/admin/dashboard-model";
import { labelOf } from "@/lib/admin/labels";
import { TASK_TYPES, taskTypeLabel } from "@/lib/admin/palette";
import { getI18nLocale, translate, type MessageKey } from "@/lib/i18n";
import { useI18n } from "@/components/providers/i18n-provider";
import { isEmployeeOnTask } from "@/lib/admin/task-team";
import { computeProjectProgress } from "@/lib/admin/project-progress";
import { isArchivedTaskStatus, isOverdue, taskIsActive } from "@/lib/admin/time";
import type { Department, Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import { isDoneTaskStatus, isPendingApproval, TASK_WRITE_STATUSES, type Task, type TaskWriteStatus } from "@/types/task";

const VIEW_KEY = "wego.workView";
type Chip = "all" | "mine" | "today" | "overdue" | "unassigned" | "done";
type Tab = "tasks" | "projects" | "team";
type ViewMode = "table" | "cards";

function tt(key: MessageKey, vars?: Record<string, string>) {
  return translate(getI18nLocale(), key, vars);
}

function teamMark(status: TeamPresence) {
  if (status === "working") return tt("team.working");
  if (status === "meeting") return tt("team.break");
  if (status === "not_started") return tt("team.notStarted");
  return tt("team.finished");
}

const cellSelect = "h-8 max-w-[8.5rem] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700";

function deadlineLabel(dueDate: string | null, today: string) {
  if (!dueDate) return "—";
  if (dueDate === today) return tt("common.today");
  const [, month, day] = dueDate.split("-");
  return `${day}/${month}`;
}

function isDoneToday(task: Task, today: string) {
  if (!isDoneTaskStatus(task.status)) return false;
  if (task.completedDate === today) return true;
  return Boolean(task.completedAt && task.completedAt.toISOString().slice(0, 10) === today);
}

function statusLabel(task: Task, today: string) {
  if (isOverdue(task, today)) return tt("status.OVERDUE");
  return labelOf(task.status);
}

function statusClass(task: Task, today: string) {
  if (isOverdue(task, today)) return "bg-red-50 text-red-700";
  if (isDoneTaskStatus(task.status)) return "bg-emerald-50 text-emerald-700";
  if (task.status === "IN_PROGRESS") return "bg-sky-50 text-sky-700";
  if (task.status === "WAITING" || task.status === "PENDING" || isPendingApproval(task.status)) return "bg-amber-50 text-amber-700";
  if (!task.projectId) return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-600";
}

export function WorkBoard({
  tasks,
  projects,
  employees,
  departments,
  team,
  today,
  currentUserId,
  employeeId,
  canManage,
  canComplete,
  canDelete,
  busyId,
  onStatus,
  onAssign,
  onDueDate,
  onProject,
  onFinish,
  onDelete,
  onSaveTask,
}: {
  tasks: Task[];
  projects: Project[];
  employees: Employee[];
  departments: Department[];
  team: TeamNowRow[];
  today: string;
  currentUserId: string;
  employeeId: string | null;
  canManage: boolean;
  canComplete: boolean;
  canDelete: boolean;
  busyId: string | null;
  onStatus: (task: Task, status: TaskWriteStatus) => Promise<void>;
  onAssign: (task: Task, assigneeId: string) => Promise<void>;
  onDueDate: (task: Task, dueDate: string) => Promise<void>;
  onProject: (task: Task, projectId: string) => Promise<void>;
  onFinish: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
  onSaveTask: (task: Task, draft: WorkTaskDraft) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("tasks");
  const [chip, setChip] = useState<Chip>("all");
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [taskType, setTaskType] = useState("");
  const [status, setStatus] = useState("");
  const [doneTodayOnly, setDoneTodayOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [view, setView] = useState<ViewMode>("table");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [panelDraft, setPanelDraft] = useState<WorkTaskDraft | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelBusy, setPanelBusy] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "table" || saved === "cards") setView(saved);
  }, []);

  function setViewMode(next: ViewMode) {
    setView(next);
    window.localStorage.setItem(VIEW_KEY, next);
  }

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest("[data-row-menu]")) setMenuId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!openTask) return;
    const fresh = tasks.find((item) => item.id === openTask.id);
    if (fresh) setOpenTask(fresh);
  }, [openTask, tasks]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (chip !== "done" && isArchivedTaskStatus(task.status)) return false;
      const mine = isEmployeeOnTask(task, employeeId) || task.createdByUserId === currentUserId;
      if (chip === "mine" && !mine) return false;
      if (chip === "today" && task.dueDate !== today) return false;
      if (chip === "overdue" && !isOverdue(task, today)) return false;
      if (chip === "unassigned" && task.projectId) return false;
      if (chip === "done" && !isDoneTaskStatus(task.status)) return false;
      if (openOnly && !taskIsActive(task)) return false;
      if (doneTodayOnly && !isDoneToday(task, today)) return false;
      if (projectId && task.projectId !== projectId) return false;
      if (assigneeId && !isEmployeeOnTask(task, assigneeId)) return false;
      if (taskType && task.taskType !== taskType) return false;
      if (status && task.status !== status && !(status === "TODO" && (task.status === "OPEN" || task.status === "TODO"))) return false;
      if (!q) return true;
      const hay = [
        task.title,
        task.description,
        projectName(projects, task.projectId),
        employeeName(employees, task.assigneeId),
        projects.find((item) => item.id === task.projectId)?.clientName ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [assigneeId, chip, currentUserId, doneTodayOnly, employeeId, employees, openOnly, projectId, projects, query, status, taskType, tasks, today]);

  const overdueCount = tasks.filter((task) => isOverdue(task, today)).length;

  function applyChip(next: Chip) {
    setChip(next);
    setDoneTodayOnly(false);
    setOpenOnly(false);
    if (next !== "all") setStatus("");
  }

  function applyKpi(id: "open" | "overdue" | "today" | "pending" | "doneToday") {
    setQuery("");
    setProjectId("");
    setAssigneeId("");
    setTaskType("");
    setDoneTodayOnly(id === "doneToday");
    setOpenOnly(id === "open");
    setTab("tasks");
    if (id === "overdue") { setChip("overdue"); setStatus(""); return; }
    if (id === "today") { setChip("today"); setStatus(""); return; }
    if (id === "pending") { setChip("all"); setStatus("PENDING_APPROVAL"); return; }
    if (id === "doneToday") { setChip("done"); setStatus(""); return; }
    setChip("all");
    setStatus("");
  }

  function openPanel(task: Task) {
    setMenuId(null);
    setOpenTask(task);
    setPanelDraft(draftFromWorkTask(task));
    setPanelError(null);
  }

  async function savePanel() {
    if (!openTask || !panelDraft) return;
    setPanelBusy(true);
    setPanelError(null);
    const ok = await onSaveTask(openTask, panelDraft);
    setPanelBusy(false);
    if (ok) {
      setOpenTask(null);
      setPanelDraft(null);
    } else {
      setPanelError(t("work.saveFailed"));
    }
  }

  const kpis = [
    { id: "open" as const, label: t("work.kpiOpen"), value: tasks.filter(taskIsActive).length },
    { id: "overdue" as const, label: t("work.kpiOverdue"), value: overdueCount },
    { id: "today" as const, label: t("work.kpiToday"), value: tasks.filter((task) => task.dueDate === today && taskIsActive(task)).length },
    { id: "pending" as const, label: t("work.kpiPending"), value: tasks.filter((task) => isPendingApproval(task.status)).length },
    { id: "doneToday" as const, label: t("work.kpiDoneToday"), value: tasks.filter((task) => isDoneToday(task, today)).length },
  ];
  const chips: Array<{ id: Chip; label: string }> = [
    { id: "all", label: t("common.all") },
    { id: "mine", label: t("work.filterMine") },
    { id: "today", label: t("common.today") },
    { id: "overdue", label: t("status.OVERDUE") },
    { id: "unassigned", label: t("work.filterUnassigned") },
    { id: "done", label: t("work.filterDone") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-2.5">
        {kpis.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => applyKpi(item.id)}
            className="inline-flex items-baseline gap-1.5 text-sm"
          >
            <span className="text-slate-500">{item.label}</span>
            <span className={`tabular-nums font-semibold ${item.id === "overdue" && item.value ? "text-red-600" : "text-[#0F172A]"}`}>{item.value}</span>
            {index < kpis.length - 1 ? <span className="ms-3 hidden text-slate-200 sm:inline">|</span> : null}
          </button>
        ))}
      </div>

      {overdueCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-sm text-red-700">
          <p>⚠ {t("work.overdueStrip", { count: String(overdueCount) })}</p>
          <button type="button" onClick={() => applyKpi("overdue")} className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-red-700">
            {t("common.show")}
          </button>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#0F172A]">{t("work.now")}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["tasks", "projects", "team"] as Tab[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`h-8 rounded-lg px-3 text-sm font-medium ${tab === item ? "bg-[#0F172A] text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {item === "tasks" ? t("work.tabTasks") : item === "projects" ? t("work.tabProjects") : t("work.tabTeam")}
                </button>
              ))}
              <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:flex">
                <button type="button" onClick={() => setViewMode("table")} className={`h-8 px-3 text-xs font-medium ${view === "table" ? "bg-[#2563EB] text-white" : "bg-white text-slate-600"}`}>{t("work.table")}</button>
                <button type="button" onClick={() => setViewMode("cards")} className={`h-8 px-3 text-xs font-medium ${view === "cards" ? "bg-[#2563EB] text-white" : "bg-white text-slate-600"}`}>{t("work.cards")}</button>
              </div>
            </div>
          </div>

          {tab === "tasks" ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("work.searchTasks")}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] ps-10 pe-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyChip(item.id)}
                    className={`h-8 rounded-lg px-2.5 text-xs font-medium ${chip === item.id ? "bg-[#0F172A] text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <select className={cellSelect + " max-w-none"} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                  <option value="">{t("common.project")}</option>
                  {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select className={cellSelect + " max-w-none"} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                  <option value="">{t("work.employee")}</option>
                  {employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
                </select>
                <select className={cellSelect + " max-w-none"} value={taskType} onChange={(event) => setTaskType(event.target.value)}>
                  <option value="">{t("work.taskType")}</option>
                  {TASK_TYPES.map((item) => <option key={item} value={item}>{taskTypeLabel(item)}</option>)}
                </select>
                <select className={cellSelect + " max-w-none"} value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">{t("common.status")}</option>
                  <option value="TODO">{t("status.TODO")}</option>
                  <option value="IN_PROGRESS">{t("status.IN_PROGRESS")}</option>
                  <option value="WAITING">{t("status.WAITING")}</option>
                  <option value="PENDING_APPROVAL">{t("status.PENDING_APPROVAL")}</option>
                  <option value="DONE">{t("status.DONE")}</option>
                </select>
              </div>
            </>
          ) : null}
        </div>

        {tab === "tasks" ? (
          rows.length ? (
            <>
              <div className={`hidden ${view === "table" ? "md:block" : ""}`}>
                <TaskTable
                  rows={rows}
                  projects={projects}
                  employees={employees}
                  departments={departments}
                  today={today}
                  canManage={canManage}
                  canComplete={canComplete}
                  canDelete={canDelete}
                  busyId={busyId}
                  menuId={menuId}
                  setMenuId={setMenuId}
                  onOpen={openPanel}
                  onStatus={onStatus}
                  onAssign={onAssign}
                  onDueDate={onDueDate}
                  onProject={onProject}
                  onFinish={onFinish}
                  onDelete={onDelete}
                />
              </div>
              <div className={view === "cards" ? "block" : "md:hidden"}>
                <TaskCards
                  rows={rows}
                  projects={projects}
                  employees={employees}
                  today={today}
                  canManage={canManage}
                  canComplete={canComplete}
                  canDelete={canDelete}
                  busyId={busyId}
                  menuId={menuId}
                  setMenuId={setMenuId}
                  onOpen={openPanel}
                  onStatus={onStatus}
                  onFinish={onFinish}
                  onDelete={onDelete}
                />
              </div>
            </>
          ) : <p className="px-4 py-8 text-sm text-slate-500">{t("work.noTasks")}</p>
        ) : null}

        {tab === "projects" ? <ProjectTable projects={projects} tasks={tasks} employees={employees} today={today} /> : null}
        {tab === "team" ? <TeamTable team={team} departments={departments} employees={employees} /> : null}
      </section>

      {openTask && panelDraft ? (
        <WorkTaskPanel
          task={openTask}
          draft={panelDraft}
          employees={employees}
          projects={projects}
          canManage={canManage}
          busy={panelBusy}
          error={panelError}
          onChange={setPanelDraft}
          onClose={() => { setOpenTask(null); setPanelDraft(null); }}
          onSave={() => void savePanel()}
        />
      ) : null}
    </div>
  );
}

function TaskTable({
  rows,
  projects,
  employees,
  departments,
  today,
  canManage,
  canComplete,
  canDelete,
  busyId,
  menuId,
  setMenuId,
  onOpen,
  onStatus,
  onAssign,
  onDueDate,
  onProject,
  onFinish,
  onDelete,
}: {
  rows: Task[];
  projects: Project[];
  employees: Employee[];
  departments: Department[];
  today: string;
  canManage: boolean;
  canComplete: boolean;
  canDelete: boolean;
  busyId: string | null;
  menuId: string | null;
  setMenuId: (id: string | null) => void;
  onOpen: (task: Task) => void;
  onStatus: (task: Task, status: TaskWriteStatus) => Promise<void>;
  onAssign: (task: Task, assigneeId: string) => Promise<void>;
  onDueDate: (task: Task, dueDate: string) => Promise<void>;
  onProject: (task: Task, projectId: string) => Promise<void>;
  onFinish: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] text-sm">
        <thead className="sticky top-0 bg-[#F8FAFC] text-xs text-slate-500">
          <tr className="text-start">
            {[tt("work.colTask"), tt("common.project"), tt("work.colClient"), tt("work.colAssignee"), tt("work.colType"), tt("work.colStatus"), tt("work.colDeadline"), tt("work.colProgress"), tt("work.colActions")].map((label) => (
              <th key={label} className="px-3 py-2.5 font-medium first:ps-4 last:pe-4">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((task) => {
            const project = projects.find((item) => item.id === task.projectId);
            const employee = employees.find((item) => item.id === task.assigneeId);
            const department = departments.find((item) => item.id === employee?.departmentId);
            const styles = categoryStyles(department?.color);
            const late = isOverdue(task, today);
            const progress = progressFromStatus(task.status);
            return (
              <tr
                key={task.id}
                className="cursor-pointer hover:bg-slate-50/80"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("select,input,button,a,textarea")) return;
                  onOpen(task);
                }}
              >
                <td className="px-3 py-2 first:ps-4">
                  <p className="max-w-[16rem] truncate font-medium text-[#0F172A]">{task.title}</p>
                </td>
                <td className="px-3 py-2">
                  {task.projectId ? (
                    <span className="text-slate-700">{projectName(projects, task.projectId)}</span>
                  ) : canManage ? (
                    <select className={cellSelect} value="" onChange={(event) => void onProject(task, event.target.value)}>
                      <option value="">{tt("work.assignProject")}</option>
                      {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  ) : <span className="text-slate-400">{tt("common.noProject")}</span>}
                </td>
                <td className="px-3 py-2 text-slate-500">{project?.clientName?.trim() || "—"}</td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select className={cellSelect} value={task.assigneeId ?? ""} disabled={busyId === task.id} onChange={(event) => void onAssign(task, event.target.value)}>
                      <option value="">{tt("common.unassigned")}</option>
                      {employees.filter((item) => item.status === "ACTIVE" || item.id === task.assigneeId).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
                    </select>
                  ) : <span>{employeeName(employees, task.assigneeId)}</span>}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: styles.badge, color: styles.badgeText }}>
                    {taskTypeLabel(task.taskType)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select
                      className={`${cellSelect} ${late ? "border-red-200 text-red-700" : ""}`}
                      value={late ? "OVERDUE" : task.status === "OPEN" || task.status === "PENDING" ? "TODO" : isDoneTaskStatus(task.status) ? "DONE" : task.status}
                      disabled={busyId === task.id}
                      onChange={(event) => {
                        const next = event.target.value as TaskWriteStatus;
                        if (next === "DONE") void onFinish(task);
                        else void onStatus(task, next);
                      }}
                    >
                      {late ? <option value="OVERDUE">{tt("status.OVERDUE")}</option> : null}
                      {TASK_WRITE_STATUSES.filter((item) => item !== "ARCHIVED").map((item) => (
                        <option key={item} value={item}>{labelOf(item)}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(task, today)}`}>{statusLabel(task, today)}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <input
                      type="date"
                      className={cellSelect}
                      value={task.dueDate ?? ""}
                      disabled={busyId === task.id}
                      onChange={(event) => void onDueDate(task, event.target.value)}
                    />
                  ) : <span className={late ? "text-red-600" : "text-slate-600"}>{deadlineLabel(task.dueDate, today)}</span>}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select
                      className={cellSelect}
                      value={progress}
                      disabled={busyId === task.id}
                      onChange={(event) => {
                        const next = statusFromProgress(Number(event.target.value));
                        if (next === "DONE") void onFinish(task);
                        else void onStatus(task, next);
                      }}
                    >
                      <option value={0}>0%</option>
                      <option value={25}>25%</option>
                      <option value={50}>50%</option>
                      <option value={100}>100%</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-slate-500">{progress}%</span>
                    </div>
                  )}
                </td>
                <td className="relative px-3 py-2 last:pe-4" onClick={(event) => event.stopPropagation()}>
                  <RowMenu
                    task={task}
                    open={menuId === task.id}
                    onToggle={() => setMenuId(menuId === task.id ? null : task.id)}
                    canComplete={canComplete}
                    canDelete={canDelete}
                    onOpen={() => onOpen(task)}
                    onFinish={() => void onFinish(task)}
                    onDelete={() => void onDelete(task)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaskCards({
  rows,
  projects,
  employees,
  today,
  canManage,
  canComplete,
  canDelete,
  busyId,
  menuId,
  setMenuId,
  onOpen,
  onStatus,
  onFinish,
  onDelete,
}: {
  rows: Task[];
  projects: Project[];
  employees: Employee[];
  today: string;
  canManage: boolean;
  canComplete: boolean;
  canDelete: boolean;
  busyId: string | null;
  menuId: string | null;
  setMenuId: (id: string | null) => void;
  onOpen: (task: Task) => void;
  onStatus: (task: Task, status: TaskWriteStatus) => Promise<void>;
  onFinish: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
}) {
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((task) => {
        const late = isOverdue(task, today);
        return (
          <article key={task.id} className="px-4 py-3">
            <button type="button" onClick={() => onOpen(task)} className="w-full text-start">
              <p className="font-medium text-[#0F172A]">{task.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{projectName(projects, task.projectId)}</p>
            </button>
            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-600">{employeeName(employees, task.assigneeId)}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(task, today)}`}>{statusLabel(task, today)}</span>
            </div>
            <p className={`mt-1 text-xs ${late ? "text-red-600" : "text-slate-500"}`}>{deadlineLabel(task.dueDate, today)}</p>
            <div className="mt-3 flex items-center gap-2">
              {canManage ? (
                <select
                  className={cellSelect}
                  value={task.status === "OPEN" || task.status === "PENDING" ? "TODO" : isDoneTaskStatus(task.status) ? "DONE" : task.status}
                  disabled={busyId === task.id}
                  onChange={(event) => {
                    const next = event.target.value as TaskWriteStatus;
                    if (next === "DONE") void onFinish(task);
                    else void onStatus(task, next);
                  }}
                >
                  {TASK_WRITE_STATUSES.filter((item) => item !== "ARCHIVED").map((item) => (
                    <option key={item} value={item}>{labelOf(item)}</option>
                  ))}
                </select>
              ) : null}
              {canComplete && !isDoneTaskStatus(task.status) ? (
                <button type="button" disabled={busyId === task.id} onClick={() => void onFinish(task)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> {tt("common.done")}
                </button>
              ) : null}
              <RowMenu
                task={task}
                open={menuId === task.id}
                onToggle={() => setMenuId(menuId === task.id ? null : task.id)}
                canComplete={canComplete}
                canDelete={canDelete}
                onOpen={() => onOpen(task)}
                onFinish={() => void onFinish(task)}
                onDelete={() => void onDelete(task)}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RowMenu({
  task,
  open,
  onToggle,
  canComplete,
  canDelete,
  onOpen,
  onFinish,
  onDelete,
}: {
  task: Task;
  open: boolean;
  onToggle: () => void;
  canComplete: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onFinish: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative" data-row-menu>
      <button type="button" onClick={onToggle} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute end-0 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
          <button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50" onClick={onOpen}>{tt("common.open")}</button>
          <Link href={`/tasks?taskId=${task.id}`} className="block px-3 py-1.5 hover:bg-slate-50">{tt("common.edit")}</Link>
          <button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50" onClick={onOpen}>{tt("work.transfer")}</button>
          {canComplete && !isDoneTaskStatus(task.status) ? (
            <button type="button" className="block w-full px-3 py-1.5 text-start hover:bg-slate-50" onClick={onFinish}>{tt("work.markCompleted")}</button>
          ) : null}
          {canDelete ? (
            <button type="button" className="block w-full px-3 py-1.5 text-start text-red-600 hover:bg-red-50" onClick={onDelete}>{tt("common.delete")}</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ProjectTable({
  projects,
  tasks,
  employees,
  today,
}: {
  projects: Project[];
  tasks: Task[];
  employees: Employee[];
  today: string;
}) {
  if (!projects.length) return <p className="px-4 py-8 text-sm text-slate-500">{tt("work.noProjects")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm">
        <thead className="bg-[#F8FAFC] text-xs text-slate-500">
          <tr>
            {[tt("common.project"), tt("work.colClient"), tt("work.colAssignee"), tt("work.tabTasks"), tt("work.completedCount"), tt("status.OVERDUE"), tt("work.colProgress"), tt("work.colDeadline"), tt("work.colStatus")].map((label) => (
              <th key={label} className="px-3 py-2.5 text-start font-medium first:ps-4 last:pe-4">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {projects.filter((project) => project.isActive !== false).map((project) => {
            const list = tasks.filter((task) => task.projectId === project.id);
            const done = list.filter((task) => isDoneTaskStatus(task.status)).length;
            const late = list.filter((task) => isOverdue(task, today)).length;
            const progress = computeProjectProgress(list);
            return (
              <tr key={project.id} className="hover:bg-slate-50/80">
                <td className="px-3 py-2.5 first:ps-4">
                  <Link href={`/projects/${project.id}`} className="font-medium text-[#0F172A] hover:text-[#2563EB]">{project.name}</Link>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{project.clientName || "—"}</td>
                <td className="px-3 py-2.5 text-slate-600">{employeeName(employees, project.managerEmployeeId)}</td>
                <td className="px-3 py-2.5 tabular-nums">{list.length}</td>
                <td className="px-3 py-2.5 tabular-nums">{done}</td>
                <td className={`px-3 py-2.5 tabular-nums ${late ? "text-red-600" : "text-slate-600"}`}>{late}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-slate-500">{progress}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{deadlineLabel(project.dueDate, today)}</td>
                <td className="px-3 py-2.5 last:pe-4">
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{labelOf(project.status)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamTable({
  team,
  departments,
  employees,
}: {
  team: TeamNowRow[];
  departments: Department[];
  employees: Employee[];
}) {
  if (!team.length) return <p className="px-4 py-8 text-sm text-slate-500">{tt("work.noEmployee")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="bg-[#F8FAFC] text-xs text-slate-500">
          <tr>
            {[tt("work.employee"), tt("common.department"), tt("work.workStatus"), tt("work.currentTask"), tt("work.clockInCol"), tt("work.hoursToday")].map((label) => (
              <th key={label} className="px-3 py-2.5 text-start font-medium first:ps-4 last:pe-4">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {team.map((row) => {
            const employee = employees.find((item) => item.id === row.id);
            const department = departments.find((item) => item.id === employee?.departmentId);
            const styles = categoryStyles(department?.color);
            return (
              <tr key={row.id}>
                <td className="px-3 py-2.5 first:ps-4 font-medium text-[#0F172A]">{row.name}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: styles.badge, color: styles.badgeText }}>
                    {row.department}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{teamMark(row.status)}</td>
                <td className="px-3 py-2.5 text-slate-600">{row.currentTask || "—"}</td>
                <td className="px-3 py-2.5 tabular-nums text-slate-600">{row.clockInTime || "—"}</td>
                <td className="px-3 py-2.5 last:pe-4 tabular-nums text-slate-600">{row.timeToday}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
