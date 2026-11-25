"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { MeetingFormModal, MeetingQuickView, draftFromMeeting, emptyMeetingDraft, type MeetingDraft } from "@/components/admin/meeting-modals";
import { MeetingTimeGrid } from "@/components/admin/meeting-time-grid";
import { TaskFormModal, emptyTaskDraft, draftFromTask, taskDraftPayload, type TaskDraft } from "@/components/admin/task-form-modal";
import { GhostButton, Modal, PrimaryButton } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { Spinner } from "@/components/ui/spinner";
import { deleteBusinessMeeting, meetingMutationMessage, mutateBusiness, saveBusinessMeeting, saveBusinessTask, taskMutationMessage } from "@/lib/admin/api";
import { meetingToEvent, taskToEvent, type CalendarEvent } from "@/lib/admin/calendar-events";
import { employeeName, projectName, useBusinessCatalog } from "@/lib/admin/catalog";
import { CALENDAR_COLOR_META, asCalendarColor, colorByIndex } from "@/lib/admin/palette";
import {
  formatDateDisplay,
  meetingParticipants,
  monthCells,
  shiftMeetingRange,
  shiftMonth,
  threeDayDates,
  weekDates,
  addMinutesToTime,
} from "@/lib/admin/meeting-time";
import { isDateOnly, isTimeOnly, todayInTimeZone } from "@/lib/dates/format";
import type { Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import type { Meeting } from "@/types/meeting";
import type { Task } from "@/types/task";

type CalendarView = "month" | "week" | "day" | "three" | "agenda";

function dateLocale(locale: string) {
  return locale === "ar" ? "ar-IL-u-nu-latn" : "he-IL-u-nu-latn";
}

function formatLocaleDate(dateOnly: string, locale: string, options: Intl.DateTimeFormatOptions) {
  if (!isDateOnly(dateOnly)) return "";
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Intl.DateTimeFormat(dateLocale(locale), { timeZone: "UTC", ...options })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function localeRangeTitle(view: CalendarView, anchor: string, locale: string) {
  if (view === "day") {
    return formatLocaleDate(anchor, locale, { weekday: "long", day: "numeric", month: "long" });
  }
  if (view === "week") {
    const days = weekDates(anchor);
    const start = days[0]!;
    const end = days[6]!;
    if (start.slice(0, 7) === end.slice(0, 7)) {
      return `${Number(start.slice(8))}–${Number(end.slice(8))} ${formatLocaleDate(start, locale, { month: "long", year: "numeric" })}`;
    }
    return `${formatDateDisplay(start)} – ${formatDateDisplay(end)}`;
  }
  if (view === "three") {
    const days = threeDayDates(anchor);
    return `${formatDateDisplay(days[0]!)} – ${formatDateDisplay(days[2]!)}`;
  }
  return formatLocaleDate(anchor, locale, { month: "long", year: "numeric" });
}

export function MeetingsView() {
  const { t, locale } = useI18n();
  const { user, business, membership, permissions } = useBusinessContext();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const timeZone = business?.timezone || "Asia/Jerusalem";
  const currentEmployeeId = membership?.employeeId ?? null;
  const canCreate = permissions.includes("meetings.create") || permissions.includes("meetings.manage") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canManage = permissions.includes("meetings.manage") || membership?.role === "BUSINESS_OWNER";
  const canCreateTask = permissions.includes("tasks.create") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canEditTask = permissions.includes("tasks.edit") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canCreateProject = permissions.includes("projects.manage") || membership?.role === "BUSINESS_OWNER";
  const canCreateDepartment = permissions.includes("departments.manage") || membership?.role === "BUSINESS_OWNER";
  const canDrag = membership?.role === "BUSINESS_OWNER" || canManage || canEditTask;

  const [isMobile, setIsMobile] = useState(false);
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(today);
  const [myOnly, setMyOnly] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [draft, setDraft] = useState<MeetingDraft | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [quick, setQuick] = useState<Meeting | null>(null);
  const [quickTask, setQuickTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [filtersReady, setFiltersReady] = useState(false);
  const searchParams = useSearchParams();
  const [openedFromQuery, setOpenedFromQuery] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      setIsMobile(media.matches);
      if (!ready) {
        setView(media.matches ? "day" : "week");
        setReady(true);
      }
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [ready]);

  useEffect(() => {
    if (filtersReady || !data.employees.length) return;
    setSelectedEmployees(data.employees.map((item) => item.id));
    setSelectedProjects(data.projects.map((item) => item.id));
    setFiltersReady(true);
  }, [data.employees, data.projects, filtersReady]);

  const filtered = useMemo(() => {
    const events = [
      ...data.meetings.map(meetingToEvent),
      ...data.tasks.map(taskToEvent),
    ].filter((item): item is CalendarEvent => Boolean(item));
    return events.filter((event) => {
      if (myOnly || employeeFilter === "mine") {
        if (!currentEmployeeId || !event.people.includes(currentEmployeeId)) return false;
      } else if (employeeFilter) {
        if (!event.people.includes(employeeFilter)) return false;
      } else if (filtersReady && event.people.length && !event.people.some((id) => selectedEmployees.includes(id))) {
        return false;
      }
      if (projectFilter && event.projectId !== projectFilter) return false;
      if (!projectFilter && filtersReady && event.projectId && !selectedProjects.includes(event.projectId)) {
        return false;
      }
      return true;
    });
  }, [currentEmployeeId, data.meetings, data.tasks, employeeFilter, filtersReady, myOnly, projectFilter, selectedEmployees, selectedProjects]);

  const days = view === "day" ? [anchor] : view === "three" ? threeDayDates(anchor) : weekDates(anchor);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (openedFromQuery || loading || !canCreate) return;
    if (searchParams.get("new") === "1") {
      setDraft(emptyMeetingDraft(today, "10:00", addMinutesToTime("10:00", 60), currentEmployeeId ? [currentEmployeeId] : []));
      setOpenedFromQuery(true);
    }
  }, [canCreate, currentEmployeeId, loading, openedFromQuery, searchParams, today]);

  if (loading || !ready) return <Spinner label={t("common.loading")} />;

  function openCreate(date = anchor, startTime = "10:00") {
    setQuick(null);
    setQuickTask(null);
    setFormError(null);
    setDraft(emptyMeetingDraft(date, startTime, addMinutesToTime(startTime, 60), currentEmployeeId ? [currentEmployeeId] : []));
  }

  function openTaskCreate(date = anchor, startTime = "09:00") {
    setQuick(null);
    setQuickTask(null);
    setDraft(null);
    setTaskDraft(emptyTaskDraft(date, startTime, addMinutesToTime(startTime, 60)));
  }

  function openEvent(event: CalendarEvent) {
    if (event.kind === "meeting") {
      const meeting = data.meetings.find((item) => item.id === event.id);
      if (meeting) setQuick(meeting);
      return;
    }
    const task = data.tasks.find((item) => item.id === event.id);
    if (task) setQuickTask(task);
  }

  async function persistEvent(event: CalendarEvent, date: string, startTime: string, endTime: string) {
    if (event.kind === "meeting") {
      const meeting = data.meetings.find((item) => item.id === event.id);
      if (meeting) await persistMeeting(meeting, { date, startTime, endTime, color: meeting.color });
      return;
    }
    const task = data.tasks.find((item) => item.id === event.id);
    if (!task || !business?.id || !canEditTask) return;
    setBusy(true);
    const result = await saveBusinessTask({
      businessId: business.id,
      id: task.id,
      data: {
        ...task,
        startDate: date,
        scheduledDate: date,
        startTime,
        endTime,
        assigneeId: task.assigneeId,
        collaboratorIds: task.collaboratorIds,
        participantIds: [task.assigneeId, ...task.collaboratorIds].filter(Boolean),
      },
    });
    setBusy(false);
    if (!result.ok) {
      setToast(taskMutationMessage(result.error, t));
      return;
    }
    await reload({ silent: true });
  }

  async function saveTaskDraft(next: TaskDraft) {
    if (!business?.id || !next.title.trim()) return { ok: false as const };
    setBusy(true);
    setTaskFormError(null);
    setTaskDraft(next);
    const result = await saveBusinessTask({
      businessId: business.id,
      id: next.id,
      data: taskDraftPayload(next),
    });
    setBusy(false);
    if (!result.ok) {
      setTaskFormError(taskMutationMessage(result.error, t));
      return { ok: false as const };
    }
    if (!next.id && result.id) setTaskDraft((prev) => (prev ? { ...prev, id: result.id } : prev));
    return { ok: true as const, id: result.id };
  }

  async function saveDraft() {
    if (!business?.id || !draft || !draft.title.trim() || !isDateOnly(draft.date) || !isTimeOnly(draft.startTime)) return;
    setBusy(true);
    setFormError(null);
    const result = await saveBusinessMeeting({
      businessId: business.id,
      id: draft.id,
      data: {
        title: draft.title,
        description: draft.description,
        notes: draft.description,
        date: draft.date,
        startTime: draft.startTime,
        endTime: isTimeOnly(draft.endTime) ? draft.endTime : null,
        location: draft.location,
        projectId: draft.projectId || null,
        meetingType: draft.meetingType,
        color: draft.color || "BLUE",
        participantIds: draft.participantIds,
        status: draft.status,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setFormError(meetingMutationMessage(result.error, t));
      return;
    }
    setDraft(null);
    setToast(t("meetings.saved"));
    await reload({ silent: true });
  }

  async function persistMeeting(meeting: Meeting, patch: Record<string, unknown>) {
    if (!business?.id) return;
    setBusy(true);
    const result = await saveBusinessMeeting({
      businessId: business.id,
      id: meeting.id,
      data: {
        title: meeting.title,
        description: meeting.description,
        notes: meeting.notes,
        date: meeting.date,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        location: meeting.location,
        projectId: meeting.projectId,
        meetingType: meeting.meetingType,
        color: meeting.color || "BLUE",
        participantIds: meetingParticipants(meeting),
        status: meeting.status,
        ...patch,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setFormError(meetingMutationMessage(result.error, t));
      return;
    }
    setQuick(null);
    setToast(t("meetings.saved"));
    await reload({ silent: true });
  }

  async function removeMeeting(meeting: Meeting) {
    if (!business?.id) return;
    setBusy(true);
    const result = await deleteBusinessMeeting(business.id, meeting.id);
    setBusy(false);
    if (!result.ok) {
      setFormError(meetingMutationMessage(result.error, t));
      return;
    }
    setQuick(null);
    await reload({ silent: true });
  }

  function toggleId(list: string[], id: string, setter: (next: string[]) => void) {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  const desktopViews: Array<{ id: CalendarView; label: string }> = [
    { id: "month", label: t("common.month") },
    { id: "week", label: t("common.week") },
    { id: "day", label: t("meetings.day") },
    { id: "agenda", label: t("meetings.agenda") },
  ];
  const mobileViews: Array<{ id: CalendarView; label: string }> = [
    { id: "day", label: t("meetings.day") },
    { id: "three", label: t("meetings.threeDays") },
    { id: "agenda", label: t("meetings.agenda") },
  ];

  return (
    <div className="-mx-1 flex h-[calc(100vh-7.25rem)] flex-col gap-3 md:-mx-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t("nav.meetings")}</h1>
          <p className="text-sm text-slate-500">{t("meetings.calendarSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateTask ? <GhostButton onClick={() => openTaskCreate()}>{t("meetings.newTask")}</GhostButton> : null}
          {canCreate ? <PrimaryButton onClick={() => openCreate()}>{t("work.newMeeting")}</PrimaryButton> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <GhostButton onClick={() => setAnchor(today)}>{t("common.today")}</GhostButton>
          <button type="button" className="rounded-lg p-2 hover:bg-slate-50" onClick={() => setAnchor(shiftMeetingRange(view, anchor, -1))} aria-label={t("meetings.prev")}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-lg p-2 hover:bg-slate-50" onClick={() => setAnchor(shiftMeetingRange(view, anchor, 1))} aria-label={t("meetings.next")}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-40 text-sm font-semibold text-slate-900">{localeRangeTitle(view, anchor, locale)}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(isMobile ? mobileViews : desktopViews).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`rounded-xl px-3 py-1.5 text-sm ${view === item.id ? "bg-[var(--brand-primary)] text-white" : "bg-slate-50 text-slate-600"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="hidden w-64 shrink-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 lg:block">
          <MiniCalendar
            anchor={anchor}
            today={today}
            onSelect={(date) => {
              setAnchor(date);
              if (view === "month") setView("day");
            }}
            onMonth={(direction) => setAnchor(shiftMonth(anchor, direction))}
          />
          <div className="mt-4 space-y-3 text-sm">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={myOnly} onChange={(event) => setMyOnly(event.target.checked)} />
              {t("meetings.myCalendar")}
            </label>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">{t("work.employee")}</p>
              {data.employees.map((employee, index) => (
                <label key={employee.id} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(employee.id)}
                    onChange={() => toggleId(selectedEmployees, employee.id, setSelectedEmployees)}
                  />
                  <span className={`h-2.5 w-2.5 rounded-full ${CALENDAR_COLOR_META[colorByIndex(index)].dot}`} />
                  {employee.displayName}
                </label>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">{t("nav.projects")}</p>
              {data.projects.map((project) => (
                <label key={project.id} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedProjects.includes(project.id)}
                    onChange={() => toggleId(selectedProjects, project.id, setSelectedProjects)}
                  />
                  <span className={`h-2.5 w-2.5 rounded-full ${CALENDAR_COLOR_META[asCalendarColor(project.color)].dot}`} />
                  {project.name}
                </label>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2 lg:hidden">
            <select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={myOnly ? "mine" : employeeFilter} onChange={(event) => {
              const value = event.target.value;
              setMyOnly(value === "mine");
              setEmployeeFilter(value === "mine" ? "" : value);
            }}>
              <option value="">{t("meetings.allEmployees")}</option>
              <option value="mine">{t("meetings.myCalendar")}</option>
              {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
            </select>
            <select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="">{t("meetings.allProjects")}</option>
              {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="hidden flex-wrap gap-2 lg:flex">
            <select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={myOnly ? "mine" : employeeFilter} onChange={(event) => {
              const value = event.target.value;
              setMyOnly(value === "mine");
              setEmployeeFilter(value === "mine" ? "" : value);
            }}>
              <option value="">{t("meetings.allEmployees")}</option>
              <option value="mine">{t("meetings.myCalendar")}</option>
              {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
            </select>
            <select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="">{t("meetings.allProjects")}</option>
              {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          {view === "month" ? (
            <MonthGrid
              anchor={anchor}
              today={today}
              events={filtered}
              onDay={(date) => {
                setAnchor(date);
                setView("day");
              }}
              onSelect={openEvent}
            />
          ) : view === "agenda" ? (
            <AgendaList
              events={filtered}
              employees={data.employees}
              projects={data.projects}
              onSelect={openEvent}
            />
          ) : (
            <MeetingTimeGrid
              days={days}
              events={filtered}
              employees={data.employees}
              projects={data.projects}
              departments={data.departments}
              today={today}
              timeZone={timeZone}
              canDrag={canDrag}
              onSlot={canCreate ? openCreate : canCreateTask ? openTaskCreate : () => undefined}
              onSelect={openEvent}
              onMove={(event, date, startTime, endTime) => void persistEvent(event, date, startTime, endTime)}
            />
          )}
        </div>
      </div>

      {isMobile ? (
        <button
          type="button"
          onClick={() => canCreate ? openCreate() : canCreateTask ? openTaskCreate() : undefined}
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white shadow-lg touch-manipulation lg:hidden"
          aria-label={t("create.task")}
        >
          <Plus className="h-6 w-6" />
        </button>
      ) : null}

      {toast ? (
        <div className="fixed bottom-24 start-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm text-white shadow-lg lg:bottom-8">
          {toast}
        </div>
      ) : null}

      {draft ? (
        <MeetingFormModal
          draft={draft}
          employees={data.employees}
          departments={data.departments}
          projects={data.projects}
          busy={busy}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={() => void saveDraft()}
          error={formError}
        />
      ) : null}

      {taskDraft && business?.id ? (
        <TaskFormModal
          draft={taskDraft}
          onChange={setTaskDraft}
          onClose={() => { setTaskDraft(null); setTaskFormError(null); }}
          onSave={(next) => saveTaskDraft(next)}
          onSaved={() => {
            setTaskDraft(null);
            setToast(t("tasks.saved"));
            void reload({ silent: true });
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
          canEditTeam={canEditTask}
          canCreateProject={canCreateProject}
          canCreateDepartment={canCreateDepartment}
          vatRate={data.settings.vatRate}
          onCatalogRefresh={() => reload({ silent: true })}
          error={taskFormError}
        />
      ) : null}

      {quickTask ? (
        <TaskQuickView
          task={quickTask}
          employees={data.employees}
          projects={data.projects}
          canManage={canEditTask}
          busy={busy}
          onClose={() => setQuickTask(null)}
          onEdit={() => {
            setTaskDraft(draftFromTask(quickTask, today));
            setQuickTask(null);
          }}
          onComplete={() => {
            if (!business?.id) return;
            void saveBusinessTask({
              businessId: business.id,
              id: quickTask.id,
              data: { ...quickTask, status: "DONE", participantIds: [quickTask.assigneeId, ...quickTask.collaboratorIds].filter(Boolean) },
            }).then((result) => {
              if (!result.ok) {
                setToast(taskMutationMessage(result.error, t));
                return;
              }
              setQuickTask(null);
              return reload({ silent: true });
            });
          }}
          onDelete={() => {
            if (!business?.id) return;
            if (!(permissions.includes("tasks.delete") || membership?.role === "BUSINESS_OWNER")) {
              setToast(t("tasks.forbidden"));
              return;
            }
            if (!window.confirm(`${t("tasks.confirmDeleteTitle")}\n${quickTask.title}`)) return;
            void mutateBusiness({ businessId: business.id, action: "deleteTask", id: quickTask.id }).then(() => {
              setQuickTask(null);
              return reload({ silent: true });
            }).catch((error: unknown) => {
              const code = error instanceof Error ? error.message : "NETWORK";
              setToast(
                code === "TASK_HAS_PAYMENTS" ? t("tasks.hasPayments")
                  : code === "TASK_HAS_WORK_HOURS" ? t("tasks.hasWorkHours")
                    : code === "TASK_HAS_DOCUMENTS" ? t("tasks.hasDocuments")
                      : code === "TASK_IN_USE" ? t("tasks.inUse")
                        : code === "FORBIDDEN" ? t("tasks.forbidden")
                          : t("tasks.network"),
              );
            });
          }}
        />
      ) : null}

      {quick ? (
        <MeetingQuickView
          meeting={quick}
          employees={data.employees}
          projects={data.projects}
          canManage={canManage}
          canEdit={canManage || quick.createdByUserId === user.id || quick.createdBy === user.id}
          busy={busy}
          onClose={() => setQuick(null)}
          onEdit={() => {
            setDraft(draftFromMeeting(quick));
            setQuick(null);
          }}
          onComplete={() => void persistMeeting(quick, { status: "COMPLETED" })}
          onCancel={() => void persistMeeting(quick, { status: "CANCELLED" })}
          onDelete={() => void removeMeeting(quick)}
        />
      ) : null}
    </div>
  );
}

function MiniCalendar({
  anchor,
  today,
  onSelect,
  onMonth,
}: {
  anchor: string;
  today: string;
  onSelect: (date: string) => void;
  onMonth: (direction: -1 | 1) => void;
}) {
  const { t, locale } = useI18n();
  const weekLetters = [t("cal.sun"), t("cal.mon"), t("cal.tue"), t("cal.wed"), t("cal.thu"), t("cal.fri"), t("cal.sat")];
  const cells = monthCells(anchor);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => onMonth(-1)} className="rounded-lg p-1 hover:bg-slate-50" aria-label={t("meetings.prevMonth")}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">{formatLocaleDate(anchor, locale, { month: "long", year: "numeric" })}</p>
        <button type="button" onClick={() => onMonth(1)} className="rounded-lg p-1 hover:bg-slate-50" aria-label={t("meetings.nextMonth")}>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
        {weekLetters.map((day) => <span key={day}>{day}</span>)}
        {cells.map((cell, index) => (
          <button
            key={cell ?? `e-${index}`}
            type="button"
            disabled={!cell}
            onClick={() => cell && onSelect(cell)}
            className={`h-7 rounded-lg text-xs ${
              cell === today
                ? "bg-[var(--brand-yellow)] font-semibold text-slate-900"
                : cell === anchor
                  ? "bg-[var(--brand-primary)] text-white"
                  : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {cell ? Number(cell.slice(8)) : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function TaskQuickView({
  task,
  employees,
  projects,
  canManage,
  busy,
  onClose,
  onEdit,
  onComplete,
  onDelete,
}: {
  task: Task;
  employees: Employee[];
  projects: Project[];
  canManage: boolean;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const people = [task.assigneeId, ...task.collaboratorIds].filter((id): id is string => Boolean(id));
  return (
    <Modal title={task.title} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">
          <span dir="ltr">{task.startTime ?? "09:00"}{task.endTime ? `–${task.endTime}` : ""}</span>
          {" · "}
          {task.startDate || task.scheduledDate || "—"}
        </p>
        <p>{t("common.project")}: {projectName(projects, task.projectId)}</p>
        <p>{t("meetings.participants")}: {people.map((id) => employeeName(employees, id)).join(", ") || "—"}</p>
        <p className="leading-6 text-slate-600">{task.description || t("meetings.noDescription")}</p>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <GhostButton onClick={onEdit}>{t("common.edit")}</GhostButton>
        {canManage ? (
          <>
            <GhostButton disabled={busy} onClick={onComplete}>{t("meetings.completeTask")}</GhostButton>
            <GhostButton disabled={busy} onClick={onDelete}>{t("common.delete")}</GhostButton>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function MonthGrid({
  anchor,
  today,
  events,
  onDay,
  onSelect,
}: {
  anchor: string;
  today: string;
  events: CalendarEvent[];
  onDay: (date: string) => void;
  onSelect: (event: CalendarEvent) => void;
}) {
  const { t } = useI18n();
  const weekLetters = [t("cal.sun"), t("cal.mon"), t("cal.tue"), t("cal.wed"), t("cal.thu"), t("cal.fri"), t("cal.sat")];
  const cells = monthCells(anchor);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {weekLetters.map((day) => (
        <div key={day} className="border-b border-s border-slate-100 bg-slate-50 px-2 py-2 text-center text-xs font-medium text-slate-500">
          {day}
        </div>
      ))}
      {cells.map((cell, index) => {
        const dayMeetings = cell ? events.filter((item) => item.date === cell).sort((a, b) => a.startTime.localeCompare(b.startTime)) : [];
        const shown = dayMeetings.slice(0, 3);
        const extra = dayMeetings.length - shown.length;
        return (
          <div key={cell ?? `e-${index}`} className={`min-h-28 border-b border-s border-slate-100 p-1.5 ${cell === today ? "bg-sky-50" : ""}`}>
            {cell ? (
              <>
                <button type="button" onClick={() => onDay(cell)} className={`mb-1 h-7 w-7 rounded-full text-sm ${cell === today ? "bg-[var(--brand-primary)] font-semibold text-white" : "text-slate-700"}`}>
                  {Number(cell.slice(8))}
                </button>
                <div className="space-y-1">
                  {shown.map((event) => (
                    <button
                      key={`${event.kind}-${event.id}`}
                      type="button"
                      onClick={() => onSelect(event)}
                      className={`block w-full truncate rounded-lg border-s-2 px-1.5 py-0.5 text-start text-[11px] ${CALENDAR_COLOR_META[event.color].bg} ${CALENDAR_COLOR_META[event.color].text} ${CALENDAR_COLOR_META[event.color].border}`}
                    >
                      <span dir="ltr">{event.startTime}</span> {event.title}
                    </button>
                  ))}
                  {extra > 0 ? (
                    <button type="button" onClick={() => onDay(cell)} className="text-[11px] text-slate-500">
                      {t("meetings.moreMeetings", { count: String(extra) })}
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function AgendaList({
  events,
  employees,
  projects,
  onSelect,
}: {
  events: CalendarEvent[];
  employees: Employee[];
  projects: Project[];
  onSelect: (event: CalendarEvent) => void;
}) {
  const { t } = useI18n();
  const groups = [...events]
    .filter((item) => isDateOnly(item.date))
    .sort((left, right) => `${left.date}${left.startTime}`.localeCompare(`${right.date}${right.startTime}`))
    .reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      acc[event.date] = acc[event.date] ?? [];
      acc[event.date]!.push(event);
      return acc;
    }, {});

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto rounded-2xl border border-slate-200 bg-white p-4">
      {Object.keys(groups).length ? Object.entries(groups).map(([date, items]) => (
        <section key={date}>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">{formatDateDisplay(date)}</h2>
          <div className="space-y-2">
            {items.map((event) => (
              <button
                key={`${event.kind}-${event.id}`}
                type="button"
                onClick={() => onSelect(event)}
                className={`flex w-full items-start justify-between rounded-xl border border-s-4 px-3 py-2 text-start hover:bg-slate-50 ${CALENDAR_COLOR_META[event.color].border}`}
              >
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-slate-500">
                    <span dir="ltr">{event.startTime}{event.endTime ? `–${event.endTime}` : ""}</span>
                    {" · "}
                    {event.location || (event.kind === "task" ? t("work.task") : t("schedule.meeting"))}
                    {" · "}
                    {projectName(projects, event.projectId)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {event.people.map((id) => employeeName(employees, id)).join(", ") || t("meetings.noParticipants")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )) : (
        <p className="py-10 text-center text-sm text-slate-500">{t("meetings.emptyRange")}</p>
      )}
    </div>
  );
}
