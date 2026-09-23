"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  CircleDot,
  ClipboardList,
  Clock3,
  FolderKanban,
  Plus,
  Timer,
  Truck,
} from "lucide-react";
import { AttendanceCard } from "@/components/admin/attendance-card";
import { ScheduleSection } from "@/components/admin/schedule-section";
import { TaskFormModal, emptyTaskDraft, taskDraftPayload, type TaskDraft } from "@/components/admin/task-form-modal";
import { PageHeader, PrimaryButton, StatusBadge } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { saveBusinessTask, taskMutationMessage } from "@/lib/admin/api";
import { useBusinessCatalog } from "@/lib/admin/catalog";
import { isEmployeeOnTask } from "@/lib/admin/task-team";
import { taskIsActive } from "@/lib/admin/time";
import { isPendingApproval } from "@/types/task";
import {
  TEAM_STATUS_LABEL,
  buildDashboardModel,
  relativeTime,
  shortDate,
  type AttentionKind,
  type TeamPresence,
} from "@/lib/admin/dashboard-model";
import { labelOf } from "@/lib/admin/labels";
import { formatBusinessDate, todayInTimeZone } from "@/lib/dates/format";

const KPI = [
  { key: "openTasks", label: "משימות פתוחות", hint: "פעילות כרגע", href: "/tasks", icon: ClipboardList, tone: "text-sky-600 bg-sky-50" },
  { key: "overdueTasks", label: "משימות באיחור", hint: "דורשות טיפול", href: "/tasks?filter=overdue", icon: AlertTriangle, tone: "text-red-600 bg-red-50" },
  { key: "workingNow", label: "עובדים פעילים עכשיו", hint: "טיימר פתוח", href: "/attendance", icon: Timer, tone: "text-emerald-600 bg-emerald-50" },
  { key: "hoursToday", label: "שעות עבודה היום", hint: "כולל טיימרים פתוחים", href: "/attendance", icon: Clock3, tone: "text-blue-600 bg-blue-50" },
  { key: "meetingsToday", label: "פגישות היום", hint: "מתוזמנות להיום", href: "/meetings", icon: CalendarRange, tone: "text-violet-600 bg-violet-50" },
  { key: "pendingRequests", label: "בקשות לאישור", hint: "ממתינות להחלטה", href: "/requests", icon: Truck, tone: "text-amber-600 bg-amber-50" },
] as const;

const ATTENTION_ICON: Record<AttentionKind, typeof AlertTriangle> = {
  overdue_task: AlertTriangle,
  due_today: CalendarClock,
  pending_request: Truck,
  upcoming_meeting: CalendarRange,
  project_risk: FolderKanban,
};

const ATTENTION_TONE: Record<AttentionKind, string> = {
  overdue_task: "bg-red-50 text-red-600",
  due_today: "bg-amber-50 text-amber-600",
  pending_request: "bg-orange-50 text-orange-600",
  upcoming_meeting: "bg-violet-50 text-violet-600",
  project_risk: "bg-red-50 text-red-600",
};

const TEAM_DOT: Record<TeamPresence, string> = {
  working: "bg-emerald-500",
  meeting: "bg-violet-500",
  not_started: "bg-slate-400",
  finished: "bg-sky-500",
};

function CompactEmpty({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-sm text-[#64748B]">
      <CircleDot className="h-3.5 w-3.5" />
      {title}
    </div>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const positive = value > 0;
  return (
    <span className={`text-xs font-medium ${positive ? "text-emerald-600" : value < 0 ? "text-red-600" : "text-slate-400"}`}>
      {positive ? "+" : ""}{value}%
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-16 rounded-2xl bg-white" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 rounded-2xl bg-white" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="h-64 rounded-2xl bg-white xl:col-span-2" />
        <div className="h-64 rounded-2xl bg-white" />
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { t, locale } = useI18n();
  const { user, business, membership, permissions } = useBusinessContext();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const timeZone = business?.timezone || "Asia/Jerusalem";
  const model = useMemo(() => buildDashboardModel(data, today, timeZone), [data, timeZone, today]);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const canCreateTask = permissions.includes("tasks.create") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canCreateMeeting = permissions.includes("meetings.create") || permissions.includes("meetings.manage") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canCreateEmployee = permissions.includes("employees.manage") || membership?.role === "BUSINESS_OWNER";
  const canEditTeam = permissions.includes("tasks.edit") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const employeeId = membership?.employeeId ?? null;
  const mine = data.tasks.filter((task) => !employeeId || isEmployeeOnTask(task, employeeId) || task.createdByUserId === user.id);
  const myTasks = mine.filter((task) => taskIsActive(task) && (task.dueDate === today || task.scheduledDate === today || task.startDate === today));
  const todoTasks = mine.filter((task) => task.status === "TODO" || task.status === "OPEN");
  const doingTasks = mine.filter((task) => task.status === "IN_PROGRESS");
  const waitingTasks = mine.filter((task) => task.status === "WAITING");
  const doneToday = mine.filter((task) => (task.status === "COMPLETED" || task.status === "DONE") && (task.updatedAt ? task.updatedAt.toDateString() === new Date().toDateString() : false));
  const pendingApproval = data.tasks.filter((task) => isPendingApproval(task.status));
  const canManageTasks = permissions.includes("tasks.edit") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const myMeetings = data.meetings.filter((item) => item.date === today && item.status !== "CANCELLED" && (!employeeId || item.participantIds.includes(employeeId) || item.participantEmployeeIds.includes(employeeId)));

  if (loading) return <DashboardSkeleton />;

  async function saveTask() {
    if (!business?.id || !draft?.title.trim()) return;
    setBusy(true);
    setFormError(null);
    const result = await saveBusinessTask({
      businessId: business.id,
      data: taskDraftPayload(draft),
    });
    setBusy(false);
    if (!result.ok) {
      setFormError(taskMutationMessage(result.error, t));
      return;
    }
    setDraft(null);
    setToast(t("tasks.saved"));
    await reload({ silent: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="order-1">
      <PageHeader
        title={`שלום, ${user.displayName || user.email}`}
        subtitle={formatBusinessDate(new Date(), locale, timeZone)}
        actions={
          <div className="hidden flex-wrap gap-2 md:flex">
            {canCreateTask ? (
              <PrimaryButton onClick={() => setDraft(emptyTaskDraft(today))}>
                <span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> {t("create.task")}</span>
              </PrimaryButton>
            ) : null}
            {canCreateMeeting ? (
              <Link href="/meetings?new=1" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("quick.meeting")}
              </Link>
            ) : null}
            {canCreateEmployee ? (
              <Link href="/settings?new=employee" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                + עובד חדש
              </Link>
            ) : null}
          </div>
        }
      />
      </div>

      {business?.id ? (
        <div className="order-2">
          <AttendanceCard
            businessId={business.id}
            employeeId={employeeId}
            sessions={data.sessions}
            onChanged={() => reload({ silent: true })}
          />
        </div>
      ) : null}

      <section className="order-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#0F172A]">המשימות שלי</h2>
          {canManageTasks && pendingApproval.length ? (
            <Link href="/tasks?tab=approval" className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {pendingApproval.length} ממתינות
            </Link>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/tasks?tab=mine", label: "לביצוע", items: todoTasks },
            { href: "/tasks?tab=progress", label: "בביצוע", items: doingTasks },
            { href: "/tasks?tab=mine", label: "ממתינות", items: waitingTasks },
            { href: "/tasks?tab=done", label: "הושלמו היום", items: doneToday },
          ].map((bucket) => (
            <Link key={bucket.label} href={bucket.href} className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{bucket.label}</p>
              <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{bucket.items.length}</p>
              {bucket.items[0] ? <p className="mt-2 truncate text-xs text-slate-600">{bucket.items[0].title}</p> : <p className="mt-2 text-xs text-slate-400">אין פריטים</p>}
            </Link>
          ))}
        </div>
      </section>

      <div className="order-4 grid grid-cols-2 gap-3 md:hidden">
        <p className="col-span-2 text-sm font-semibold text-[#0F172A]">{t("quick.title")}</p>
        <Link href="/tasks?new=1" className="rounded-2xl border border-[#E2E8F0] bg-white px-3 py-4 text-center text-sm font-medium">{t("quick.task")}</Link>
        <Link href="/meetings?new=1" className="rounded-2xl border border-[#E2E8F0] bg-white px-3 py-4 text-center text-sm font-medium">{t("quick.meeting")}</Link>
        <Link href="/requests" className="rounded-2xl border border-[#E2E8F0] bg-white px-3 py-4 text-center text-sm font-medium">{t("quick.request")}</Link>
        <a href="#home-schedule" className="rounded-2xl border border-[#E2E8F0] bg-white px-3 py-4 text-center text-sm font-medium">{t("quick.schedule")}</a>
      </div>

      <div className="order-4 space-y-4 md:hidden">
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
          <h2 className="text-sm font-semibold">{t("dashboard.myTasksToday")}</h2>
          {myTasks.length ? myTasks.slice(0, 4).map((task) => (
            <p key={task.id} className="mt-2 border-s-4 border-s-blue-500 ps-2 text-sm">{task.title}</p>
          )) : <CompactEmpty title="אין משימות להיום" />}
        </section>
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
          <h2 className="text-sm font-semibold">{t("dashboard.upcomingMeetingsTitle")}</h2>
          {myMeetings.length ? myMeetings.slice(0, 4).map((meeting) => (
            <p key={meeting.id} className="mt-2 border-s-4 border-s-violet-500 ps-2 text-sm">{meeting.startTime} · {meeting.title}</p>
          )) : <CompactEmpty title="אין פגישות להיום" />}
        </section>
      </div>

      <div className="order-8 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:order-3 md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-6">
        {KPI.map((item) => {
          const Icon = item.icon;
          const value = model.kpis[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className="min-w-[168px] rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:min-w-0"
            >
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${item.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-[#0F172A]">{value}</p>
              <p className="mt-1 text-sm text-[#0F172A]">{item.label}</p>
              <p className="mt-0.5 text-xs text-[#64748B]">{item.hint}</p>
            </Link>
          );
        })}
      </div>

      <div className="order-6 grid gap-5 md:order-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:col-span-2">
          <h2 className="text-base font-semibold text-[#0F172A]">דורש את תשומת הלב שלך</h2>
          {model.attention.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {model.attention.map((item) => {
                const Icon = ATTENTION_ICON[item.kind];
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ATTENTION_TONE[item.kind]}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#0F172A]">{item.title}</p>
                      <p className="truncate text-xs text-[#64748B]">{item.meta}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.deadline}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusBadge value={item.kind === "overdue_task" || item.kind === "project_risk" ? "OVERDUE" : item.kind === "due_today" ? "PENDING" : "SCHEDULED"} label={item.badge} />
                      <Link href={item.href} className="text-xs font-medium text-[#2563EB] hover:underline">{item.action}</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <CompactEmpty title="אין פריטים שדורשים טיפול כרגע" />
          )}
        </section>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-base font-semibold text-[#0F172A]">הצוות עכשיו</h2>
          {model.team.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {model.team.map((row) => (
                <div key={row.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-sm font-semibold text-white">
                    {row.initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#0F172A]">{row.name}</p>
                    <p className="truncate text-xs text-[#64748B]">{row.department}{row.currentTask ? ` · ${row.currentTask}` : ""}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <span className={`h-1.5 w-1.5 rounded-full ${TEAM_DOT[row.status]}`} />
                      {TEAM_STATUS_LABEL[row.status]}
                    </p>
                    {row.status === "working" && row.clockInTime ? (
                      <p className="mt-1 text-xs text-emerald-700">{t("team.started", { time: row.clockInTime })} · {t("team.workingFor", { time: row.timeToday })}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs font-medium text-slate-500">
                    {row.hasTime ? row.timeToday : TEAM_STATUS_LABEL.not_started}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <CompactEmpty title="אין עובדים פעילים להצגה" />
          )}
        </section>
      </div>

      {business?.id ? (
        <div className="order-5 md:order-6">
          <ScheduleSection
            title={t("schedule.title")}
            data={data}
            today={today}
            businessId={business.id}
            employeeId={undefined}
            canManageMeetings={canCreateMeeting}
            onReload={() => reload({ silent: true })}
          />
        </div>
      ) : null}

      <div className="order-9 grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="mb-4 text-base font-semibold text-[#0F172A]">בריאות פרויקטים</h2>
          {model.projects.length ? (
            <div className="grid gap-3">
              {model.projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="rounded-2xl border border-slate-100 p-4 hover:border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{project.name}</p>
                      <p className="text-xs text-[#64748B]">{project.manager}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge value={project.status} label={labelOf(project.status)} />
                      {project.health === "risk" ? <span className="text-[11px] font-medium text-red-600">בסיכון</span> : null}
                      {project.health === "on_track" ? <span className="text-[11px] font-medium text-emerald-600">במסלול</span> : null}
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${project.progress}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B]">
                    <span>{project.done} / {project.total} הושלמו</span>
                    <span>{project.overdue} באיחור</span>
                    {project.deadline ? <span>דדליין {shortDate(project.deadline)}</span> : null}
                    {project.team.length ? (
                      <span className="inline-flex -space-x-1 space-x-reverse">
                        {project.team.map((initial, index) => (
                          <span key={`${project.id}-${index}`} className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700">{initial}</span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <CompactEmpty title="אין פרויקטים להצגה" />
          )}
        </section>
      </div>

      <div className="order-9 grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="mb-4 text-base font-semibold text-[#0F172A]">תמונת העסק השבוע</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "שעות עבודה", value: model.weekly.hours, delta: model.weekly.hoursDelta },
              { label: "משימות שהושלמו", value: model.weekly.completedTasks, delta: model.weekly.completedDelta },
              { label: "משימות חדשות", value: model.weekly.newTasks, delta: model.weekly.newDelta },
              { label: "פגישות", value: model.weekly.meetings, delta: model.weekly.meetingsDelta },
              { label: "משימות באיחור", value: model.weekly.overdue, delta: model.weekly.overdueDelta },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-[#F5F7FB] px-3 py-3">
                <p className="text-xs text-[#64748B]">{item.label}</p>
                <p className="mt-1 text-xl font-semibold text-[#0F172A]">{item.value}</p>
                <Delta value={item.delta} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="mb-4 text-base font-semibold text-[#0F172A]">עומס לפי מחלקה</h2>
          {model.departments.length ? (
            <div className="space-y-3">
              {model.departments.map((department) => {
                const load = department.openTasks + department.overdueTasks;
                const width = Math.min(100, load * 12);
                return (
                  <Link key={department.id} href={`/tasks?departmentId=${department.id}`} className="block rounded-xl border border-slate-100 px-3 py-3 hover:border-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[#0F172A]">{department.name}</p>
                      <p className="text-xs text-[#64748B]">{department.employees} עובדים</p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${width}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-[#64748B]">
                      {department.openTasks} פתוחות · {department.overdueTasks} באיחור · {department.hours} שעות השבוע
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <CompactEmpty title="אין מחלקות מוגדרות" />
          )}
        </section>
      </div>

      <section className="order-9 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="mb-4 text-base font-semibold text-[#0F172A]">פעילות אחרונה</h2>
        {model.activity.length ? (
          <div className="divide-y divide-slate-100">
            {model.activity.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm text-[#0F172A]">{item.message || item.action}</p>
                  {item.entityType ? <p className="text-xs text-[#64748B]">{item.entityType}</p> : null}
                </div>
                <p className="shrink-0 text-xs text-slate-400">{relativeTime(item.createdAt)}</p>
              </div>
            ))}
          </div>
        ) : (
          <CompactEmpty title="אין פעילות אחרונה" />
        )}
      </section>

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
          projects={data.projects}
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
