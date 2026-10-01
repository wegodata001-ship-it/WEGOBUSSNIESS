"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { EmployeeTaskSheet } from "@/components/employee/employee-task-sheet";
import { TaskFormModal, emptyTaskDraft, taskDraftPayload, type TaskDraft } from "@/components/admin/task-form-modal";
import { PrimaryButton } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { changeBusinessTaskStatus, saveBusinessTask, saveTaskWork, taskMutationMessage } from "@/lib/admin/api";
import { employeeName, projectName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { isEmployeeOnTask } from "@/lib/admin/task-team";
import { isDoneTaskStatus, isOverdue, taskIsActive } from "@/lib/admin/time";
import {
  dayLoad,
  monthDays,
  shortDay,
  weekDays,
  workDate,
  type DayLoad,
} from "@/lib/admin/work-date";
import { shiftDateOnly, todayInTimeZone } from "@/lib/dates/format";
import { finishTask } from "@/lib/tasks/actions";
import type { Project } from "@/types/department";
import { isPendingApproval, type Task, type TaskWriteStatus } from "@/types/task";
import type { Meeting } from "@/types/meeting";

const STORE_KEY = "wego.employeeWorkspace";
const LOAD_MARK: Record<DayLoad, { text: string; className: string }> = {
  empty: { text: "", className: "text-transparent" },
  some: { text: "•", className: "text-slate-400" },
  many: { text: "•••", className: "text-slate-500" },
  overdue: { text: "•", className: "text-red-500" },
  done: { text: "✓", className: "text-emerald-600" },
};

type Mode = "board" | "list";
type Range = "today" | "week" | "month";
type ListChip = "all" | "today" | "overdue" | "done";

function isMineTask(task: Task, employeeId: string | null, userId: string) {
  if (employeeId && isEmployeeOnTask(task, employeeId)) return true;
  return task.createdByUserId === userId;
}

function isMineMeeting(meeting: Meeting, employeeId: string | null, userId: string) {
  if (employeeId && (meeting.participantIds.includes(employeeId) || meeting.participantEmployeeIds.includes(employeeId))) return true;
  return meeting.createdByUserId === userId;
}

function weekdayTitle(date: string, locale: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IL" : "he-IL", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function EmployeeWorkspace() {
  const { t, locale } = useI18n();
  const weekLetters = [t("cal.sun"), t("cal.mon"), t("cal.tue"), t("cal.wed"), t("cal.thu"), t("cal.fri"), t("cal.sat")];
  const { user, business, membership, permissions } = useBusinessContext();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const employeeId = membership?.employeeId ?? null;
  const [selectedDate, setSelectedDate] = useState(today);
  const [mode, setMode] = useState<Mode>("board");
  const [range, setRange] = useState<Range>("week");
  const [listChip, setListChip] = useState<ListChip>("all");
  const [query, setQuery] = useState("");
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || "null") as { mode?: Mode; range?: Range } | null;
      if (saved?.mode === "board" || saved?.mode === "list") setMode(saved.mode);
      if (saved?.range === "today" || saved?.range === "week" || saved?.range === "month") setRange(saved.range);
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ mode, range }));
  }, [mode, range]);

  useEffect(() => {
    setLocalTasks(null);
  }, [data.tasks]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setInterval(() => reload({ silent: true }), 15000);
    const onFocus = () => reload({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  const canCreateTask = permissions.includes("tasks.create") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canCreateMeeting = permissions.includes("meetings.create") || permissions.includes("meetings.manage") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canEditTeam = permissions.includes("tasks.edit") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canWork = Boolean(employeeId) || canEditTeam;
  const tasks = localTasks ?? data.tasks;
  const mine = useMemo(
    () => tasks.filter((task) => isMineTask(task, employeeId, user.id)),
    [employeeId, tasks, user.id],
  );
  const meetings = useMemo(
    () => data.meetings.filter((item) => isMineMeeting(item, employeeId, user.id) && item.status !== "CANCELLED"),
    [data.meetings, employeeId, user.id],
  );

  const overdue = mine.filter((task) => isOverdue(task, today));
  const kpis = [
    { label: t("work.kpiOpen"), value: mine.filter(taskIsActive).length },
    { label: t("work.kpiOverdue"), value: overdue.length },
    { label: t("work.kpiToday"), value: mine.filter((task) => workDate(task) === today && taskIsActive(task)).length },
    { label: t("work.kpiPending"), value: mine.filter((task) => isPendingApproval(task.status)).length },
    { label: t("work.kpiDoneToday"), value: mine.filter((task) => isDoneTaskStatus(task.status) && (task.completedDate === today || workDate(task) === today)).length },
  ];

  const days = range === "month" ? monthDays(selectedDate).days : range === "today" ? [selectedDate] : weekDays(selectedDate);
  const week = weekDays(selectedDate);
  const monthMeta = monthDays(selectedDate);

  const dayTasks = mine.filter((task) => workDate(task) === selectedDate);
  const dayMeetings = meetings.filter((item) => item.date === selectedDate);
  const timed = [
    ...dayMeetings.map((item) => ({ kind: "meeting" as const, time: item.startTime || "", item })),
    ...dayTasks.filter((task) => task.startTime).map((task) => ({ kind: "task" as const, time: task.startTime || "", item: task })),
  ].sort((left, right) => left.time.localeCompare(right.time));
  const untimed = dayTasks.filter((task) => !task.startTime);

  const listRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine.filter((task) => {
      if (listChip === "today" && workDate(task) !== today) return false;
      if (listChip === "overdue" && !isOverdue(task, today)) return false;
      if (listChip === "done" && !isDoneTaskStatus(task.status)) return false;
      if (!q) return true;
      return [task.title, projectName(data.projects, task.projectId), employeeName(data.employees, task.assigneeId)].join(" ").toLowerCase().includes(q);
    });
  }, [data.employees, data.projects, listChip, mine, query, today]);

  function patchLocal(id: string, patch: Partial<Task>) {
    setLocalTasks((current) => (current ?? data.tasks).map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }

  async function refresh() {
    await reload({ silent: true });
  }

  async function saveTask() {
    if (!business?.id || !draft?.title.trim()) return;
    setBusy(true);
    setFormError(null);
    const result = await saveBusinessTask({ businessId: business.id, id: draft.id, data: taskDraftPayload(draft) });
    setBusy(false);
    if (!result.ok) {
      setFormError(taskMutationMessage(result.error, t));
      return;
    }
    setDraft(null);
    setToast(t("tasks.saved"));
    await refresh();
  }

  async function complete(task: Task) {
    if (!business?.id) return;
    patchLocal(task.id, { status: "COMPLETED" });
    try {
      await finishTask(business.id, task.id);
      await refresh();
    } catch {
      setLocalTasks(null);
      setToast(t("tasks.network"));
    }
  }

  async function changeStatus(task: Task, status: TaskWriteStatus) {
    if (!business?.id) return;
    if (status === "DONE") {
      await complete(task);
      return;
    }
    patchLocal(task.id, { status });
    const result = await changeBusinessTaskStatus({ businessId: business.id, id: task.id, status });
    if (!result.ok) {
      setLocalTasks(null);
      setSheetError(taskMutationMessage(result.error, t));
      return;
    }
    await refresh();
  }

  async function changeWork(task: Task, data: { scheduledDate?: string | null; startTime?: string | null; description?: string }) {
    if (!business?.id) return;
    patchLocal(task.id, {
      scheduledDate: data.scheduledDate === undefined ? task.scheduledDate : data.scheduledDate,
      startTime: data.startTime === undefined ? task.startTime : data.startTime,
      description: data.description === undefined ? task.description : data.description,
    });
    const result = await saveTaskWork({ businessId: business.id, id: task.id, data });
    if (!result.ok) {
      setLocalTasks(null);
      setSheetError(taskMutationMessage(result.error, t));
      setToast(t("tasks.network"));
      return;
    }
    await refresh();
  }

  async function moveTask(taskId: string, date: string) {
    const task = mine.find((item) => item.id === taskId);
    if (!task) return;
    await changeWork(task, { scheduledDate: date });
    setSelectedDate(date);
    setDragId(null);
  }

  function jump(offset: number) {
    if (range === "today") setSelectedDate(shiftDateOnly(selectedDate, offset));
    else if (range === "week") setSelectedDate(shiftDateOnly(selectedDate, offset * 7));
    else setSelectedDate(shiftDateOnly(selectedDate, offset * 30));
  }

  function goToday() {
    setSelectedDate(today);
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 rounded-2xl bg-white" />
        <div className="h-12 rounded-2xl bg-white" />
        <div className="h-80 rounded-2xl bg-white" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[28px] font-bold leading-tight text-[#0F172A]">{t("work.hello", { name: user.displayName || user.email })}</h1>
        <div className="flex flex-wrap gap-2">
          {canCreateTask ? (
            <PrimaryButton onClick={() => setDraft(emptyTaskDraft(selectedDate))}>
              <span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> {t("work.newTask")}</span>
            </PrimaryButton>
          ) : null}
          {canCreateMeeting ? (
            <Link href="/meetings?new=1" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
              {t("quick.meeting")}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-2.5">
        {kpis.map((item, index) => (
          <span key={item.label} className="inline-flex items-baseline gap-1.5 text-sm">
            <span className="text-slate-500">{item.label}</span>
            <span className={`tabular-nums font-semibold ${item.label === t("work.kpiOverdue") && item.value ? "text-red-600" : "text-[#0F172A]"}`}>{item.value}</span>
            {index < kpis.length - 1 ? <span className="ms-1 hidden text-slate-200 sm:inline">|</span> : null}
          </span>
        ))}
      </div>

      {overdue.length ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-sm text-red-700">
          <p>⚠ {t("work.overdueStrip", { count: String(overdue.length) })}</p>
          <button
            type="button"
            onClick={() => { setMode("list"); setListChip("overdue"); }}
            className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-red-700"
          >
            {t("common.show")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
          <button type="button" onClick={() => setMode("board")} className={`h-8 rounded-lg px-3 text-sm font-medium ${mode === "board" ? "bg-[#0F172A] text-white" : "text-slate-600"}`}>{t("work.board")}</button>
          <button type="button" onClick={() => setMode("list")} className={`h-8 rounded-lg px-3 text-sm font-medium ${mode === "list" ? "bg-[#0F172A] text-white" : "text-slate-600"}`}>{t("work.list")}</button>
        </div>
        {mode === "board" ? (
          <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
            {(["today", "week", "month"] as Range[]).map((item) => (
              <button key={item} type="button" onClick={() => setRange(item)} className={`h-8 rounded-lg px-3 text-sm font-medium ${range === item ? "bg-[#2563EB] text-white" : "text-slate-600"}`}>
                {item === "today" ? t("common.today") : item === "week" ? t("common.week") : t("common.month")}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {mode === "board" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">{range === "month" ? t("work.myMonth") : range === "today" ? t("work.myDay") : t("work.myWeek")}</h2>
                <p className="text-sm text-slate-500">
                  {range === "month" ? `${shortDay(monthMeta.first)} - ${shortDay(monthMeta.last)}` : range === "today" ? shortDay(selectedDate) : `${shortDay(week[0])} - ${shortDay(week[6])}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => jump(-1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200"><ChevronRight className="h-4 w-4" /></button>
                <button type="button" onClick={goToday} className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium">{t("common.today")}</button>
                <button type="button" onClick={() => jump(1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200"><ChevronLeft className="h-4 w-4" /></button>
              </div>
            </div>

            {range === "month" ? (
              <div className="grid grid-cols-7 gap-1">
                {weekLetters.map((letter) => <p key={letter} className="text-center text-[11px] text-slate-400">{letter}</p>)}
                {days.map((date) => (
                  <DayCell
                    key={date}
                    date={date}
                    today={today}
                    selected={selectedDate}
                    muted={date < monthMeta.first || date > monthMeta.last}
                    load={dayLoad(date, today, mine, meetings)}
                    onSelect={setSelectedDate}
                    onDrop={moveTask}
                    dragId={dragId}
                  />
                ))}
              </div>
            ) : (
              <div className={`grid gap-1 ${range === "today" ? "grid-cols-1" : "grid-cols-7"}`}>
                {(range === "today" ? [selectedDate] : week).map((date, index) => (
                  <DayCell
                    key={date}
                    date={date}
                    today={today}
                    selected={selectedDate}
                    letter={weekLetters[index] ?? weekLetters[new Date(`${date}T12:00:00Z`).getUTCDay()]}
                    load={dayLoad(date, today, mine, meetings)}
                    onSelect={setSelectedDate}
                    onDrop={moveTask}
                    dragId={dragId}
                    tall
                  />
                ))}
              </div>
            )}
          </section>

          <DayDetails
            date={selectedDate}
            locale={locale}
            today={today}
            timed={timed}
            untimed={untimed}
            projects={data.projects}
            onOpenTask={setOpenTask}
            onDragStart={setDragId}
            canDrag={canWork}
          />
        </div>
      ) : (
        <PersonalList
          rows={listRows}
          projects={data.projects}
          today={today}
          query={query}
          chip={listChip}
          onQuery={setQuery}
          onChip={setListChip}
          onOpen={setOpenTask}
          onFinish={(task) => void complete(task)}
        />
      )}

      {openTask ? (
        <EmployeeTaskSheet
          task={mine.find((item) => item.id === openTask.id) ?? openTask}
          employees={data.employees}
          projects={data.projects}
          canWork={canWork && isMineTask(openTask, employeeId, user.id)}
          busy={busy}
          error={sheetError}
          onClose={() => { setOpenTask(null); setSheetError(null); }}
          onFinish={() => void complete(openTask)}
          onStatus={(status) => void changeStatus(openTask, status)}
          onSaveWork={(payload) => void changeWork(openTask, payload)}
        />
      ) : null}

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
          onSave={() => void saveTask()}
          busy={busy}
          businessId={business.id}
          employees={data.employees}
          departments={data.departments}
          departmentCategories={data.departmentCategories}
          projects={data.projects}
          projectsError={data.projectsError}
          taskTemplates={data.taskTemplates}
          libraryTasks={data.tasks}
          canEditTeam={canEditTeam}
          canCreateProject={permissions.includes("projects.manage") || membership?.role === "BUSINESS_OWNER"}
          canCreateDepartment={permissions.includes("departments.manage") || membership?.role === "BUSINESS_OWNER"}
          onCatalogRefresh={() => reload({ silent: true })}
          error={formError}
        />
      ) : null}
    </div>
  );
}

function DayCell({
  date,
  today,
  selected,
  load,
  onSelect,
  onDrop,
  dragId,
  letter,
  muted,
  tall,
}: {
  date: string;
  today: string;
  selected: string;
  load: DayLoad;
  onSelect: (date: string) => void;
  onDrop: (taskId: string, date: string) => void;
  dragId: string | null;
  letter?: string;
  muted?: boolean;
  tall?: boolean;
}) {
  const mark = LOAD_MARK[load];
  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const id = dragId || event.dataTransfer.getData("text/plain");
        if (id) onDrop(id, date);
      }}
      className={`rounded-xl border px-1 py-2 text-center ${tall ? "min-h-16 md:min-h-20" : "min-h-12"} ${
        selected === date ? "border-[#2563EB] bg-sky-50" : "border-transparent bg-slate-50"
      } ${date === today ? "ring-1 ring-[#2563EB]/30" : ""} ${muted ? "opacity-40" : ""}`}
    >
      {letter ? <p className="text-[11px] text-slate-400">{letter}</p> : null}
      <p className="text-sm font-semibold tabular-nums text-[#0F172A]">{date.slice(8)}</p>
      <p className={`h-3 text-[11px] leading-none ${mark.className}`}>{mark.text}</p>
    </button>
  );
}

function DayDetails({
  date,
  locale,
  today,
  timed,
  untimed,
  projects,
  onOpenTask,
  onDragStart,
  canDrag,
}: {
  date: string;
  locale: string;
  today: string;
  timed: Array<{ kind: "task" | "meeting"; time: string; item: Task | Meeting }>;
  untimed: Task[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
  onDragStart: (id: string) => void;
  canDrag: boolean;
}) {
  const { t } = useI18n();
  const taskCount = timed.filter((item) => item.kind === "task").length + untimed.length;
  const meetingCount = timed.filter((item) => item.kind === "meeting").length;
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <h2 className="text-lg font-semibold text-[#0F172A]">{weekdayTitle(date, locale)}</h2>
      <p className="mt-1 text-sm text-slate-500">{t("work.dayTasksMeetings", { tasks: String(taskCount), meetings: String(meetingCount) })}</p>
      <div className="mt-4 space-y-2">
        {timed.map((entry) => {
          if (entry.kind === "meeting") {
            const meeting = entry.item as Meeting;
            return (
              <article key={`m-${meeting.id}`} className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2.5">
                <p className="text-xs font-semibold tabular-nums text-violet-700">{entry.time || t("schedule.meeting")}</p>
                <p className="text-sm font-medium text-[#0F172A]">📅 {meeting.title}</p>
                <p className="text-xs text-slate-500">{meeting.location || t("schedule.meeting")}</p>
              </article>
            );
          }
          const task = entry.item as Task;
          return (
            <TaskCard
              key={task.id}
              task={task}
              today={today}
              time={entry.time}
              project={projectName(projects, task.projectId)}
              canDrag={canDrag}
              onOpen={() => onOpenTask(task)}
              onDragStart={() => onDragStart(task.id)}
            />
          );
        })}
        {untimed.length ? (
          <div className="pt-2">
            <p className="mb-2 text-xs font-medium text-slate-500">{t("work.untimed")}</p>
            <div className="space-y-2">
              {untimed.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  today={today}
                  project={projectName(projects, task.projectId)}
                  canDrag={canDrag}
                  onOpen={() => onOpenTask(task)}
                  onDragStart={() => onDragStart(task.id)}
                />
              ))}
            </div>
          </div>
        ) : null}
        {!timed.length && !untimed.length ? <p className="py-6 text-sm text-slate-500">{t("work.noWork")}</p> : null}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  today,
  time,
  project,
  canDrag,
  onOpen,
  onDragStart,
}: {
  task: Task;
  today: string;
  time?: string;
  project: string;
  canDrag: boolean;
  onOpen: () => void;
  onDragStart: () => void;
}) {
  return (
    <button
      type="button"
      draggable={canDrag}
      onDragStart={(event) => {
        onDragStart();
        event.dataTransfer.setData("text/plain", task.id);
      }}
      onClick={onOpen}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-start hover:bg-slate-50"
    >
      {time ? <p className="text-xs font-semibold tabular-nums text-slate-500">{time}</p> : null}
      <p className="text-sm font-medium text-[#0F172A]">{isDoneTaskStatus(task.status) ? "✓ " : ""}{task.title}</p>
      <p className="text-xs text-slate-500">{project}</p>
      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isOverdue(task, today) ? "bg-red-50 text-red-700" : isDoneTaskStatus(task.status) ? "bg-emerald-50 text-emerald-700" : task.status === "IN_PROGRESS" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"
      }`}>
        {isOverdue(task, today) ? labelOf("OVERDUE") : labelOf(isDoneTaskStatus(task.status) ? "DONE" : task.status)}
      </span>
    </button>
  );
}

function PersonalList({
  rows,
  projects,
  today,
  query,
  chip,
  onQuery,
  onChip,
  onOpen,
  onFinish,
}: {
  rows: Task[];
  projects: Project[];
  today: string;
  query: string;
  chip: ListChip;
  onQuery: (value: string) => void;
  onChip: (chip: ListChip) => void;
  onOpen: (task: Task) => void;
  onFinish: (task: Task) => void;
}) {
  const { t } = useI18n();
  const chips: Array<{ id: ListChip; label: string }> = [
    { id: "all", label: t("common.all") },
    { id: "today", label: t("common.today") },
    { id: "overdue", label: t("status.OVERDUE") },
    { id: "done", label: t("work.filterDone") },
  ];
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white">
      <div className="space-y-3 border-b border-slate-100 px-4 py-3">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t("work.searchTaskProject")}
          className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#2563EB]"
        />
        <div className="flex flex-wrap gap-1.5">
          {chips.map((item) => (
            <button key={item.id} type="button" onClick={() => onChip(item.id)} className={`h-8 rounded-lg px-2.5 text-xs font-medium ${chip === item.id ? "bg-[#0F172A] text-white" : "bg-slate-100 text-slate-600"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-xs text-slate-500">
            <tr>
              {[t("work.colTask"), t("common.project"), t("common.status"), t("work.workDayCol"), t("common.deadline")].map((label) => (
                <th key={label} className="px-3 py-2.5 text-start font-medium first:ps-4">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((task) => (
              <tr key={task.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(task)}>
                <td className="px-3 py-2.5 first:ps-4 font-medium text-[#0F172A]">{task.title}</td>
                <td className="px-3 py-2.5 text-slate-600">{projectName(projects, task.projectId)}</td>
                <td className="px-3 py-2.5">{isOverdue(task, today) ? t("status.OVERDUE") : labelOf(isDoneTaskStatus(task.status) ? "DONE" : task.status)}</td>
                <td className="px-3 py-2.5 tabular-nums">{workDate(task) ? shortDay(workDate(task)!) : "—"}</td>
                <td className="px-3 py-2.5 tabular-nums">{task.dueDate ? shortDay(task.dueDate) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {rows.map((task) => (
          <article key={task.id} className="px-4 py-3">
            <button type="button" onClick={() => onOpen(task)} className="w-full text-start">
              <p className="font-medium text-[#0F172A]">{task.title}</p>
              <p className="text-xs text-slate-500">{projectName(projects, task.projectId)}</p>
              <p className="mt-1 text-xs text-slate-500">{workDate(task) ? shortDay(workDate(task)!) : "—"} · {isOverdue(task, today) ? t("status.OVERDUE") : labelOf(isDoneTaskStatus(task.status) ? "DONE" : task.status)}</p>
            </button>
            {!isDoneTaskStatus(task.status) ? (
              <button type="button" onClick={() => onFinish(task)} className="mt-2 h-8 rounded-lg bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700">{t("work.doneShort")}</button>
            ) : null}
          </article>
        ))}
      </div>
      {!rows.length ? <p className="px-4 py-8 text-sm text-slate-500">{t("work.noTasks")}</p> : null}
    </section>
  );
}
