"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { categoryStyles } from "@/lib/admin/category-color";
import { resolveProjectCategory } from "@/lib/admin/department-categories";
import { employeeName, sessionHours, useBusinessCatalog } from "@/lib/admin/catalog";
import { computeProjectProgress, isCompletedTaskStatus } from "@/lib/admin/project-progress";
import { labelOf } from "@/lib/admin/labels";
import { actualHoursForTask, isOverdue, taskIsActive } from "@/lib/admin/time";
import { isDateOnly, todayInTimeZone } from "@/lib/dates/format";
import { ClipboardList, FileArchive, Users } from "lucide-react";
import { pricedTaskFinance, recordedMovements } from "@/lib/finance/summary";
import { formatIls } from "@/lib/finance/money";
import type { MessageKey } from "@/lib/i18n";

const TABS: Array<{ id: "overview" | "tasks" | "hours" | "documents" | "team" | "activity"; key: MessageKey }> = [
  { id: "overview", key: "projects.tabOverview" },
  { id: "tasks", key: "work.tabTasks" },
  { id: "hours", key: "projects.tabHours" },
  { id: "documents", key: "projects.tabDocuments" },
  { id: "team", key: "work.tabTeam" },
  { id: "activity", key: "projects.tabActivity" },
];

function formatProjectDate(dateOnly: string, locale: string) {
  if (!isDateOnly(dateOnly)) return dateOnly;
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IL-u-nu-latn" : "he-IL-u-nu-latn", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function ProjectWorkspace() {
  const { t, locale } = useI18n();
  const params = useParams<{ projectId: string }>();
  const { business, membership, permissions } = useBusinessContext();
  const canViewFinance = permissions.includes("finance.view") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const today = todayInTimeZone(business?.timezone);
  const projectId = String(params.projectId ?? "");
  const project = data.projects.find((item) => item.id === projectId);

  const tasks = useMemo(() => data.tasks.filter((task) => task.projectId === projectId), [data.tasks, projectId]);
  const openTasks = useMemo(() => tasks.filter((task) => !isCompletedTaskStatus(task.status)), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((task) => isCompletedTaskStatus(task.status)), [tasks]);

  useEffect(() => {
    function onFocus() {
      void reload({ silent: true });
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);
  const docs = data.documents.filter((item) => item.projectId === params.projectId);
  const hours = sessionHours(data.sessions.filter((session) => tasks.some((task) => task.id === session.taskId)));
  const teamIds = [...new Set(tasks.flatMap((task) => [task.assigneeId, ...task.collaboratorIds].filter(Boolean)))] as string[];

  if (loading) return <Spinner label={t("common.loading")} />;
  if (!project) return <EmptyState icon={ClipboardList} title={t("projects.notFound")} />;

  const progress = computeProjectProgress(tasks);
  const resolved = resolveProjectCategory(project, data.departmentCategories);
  const styles = categoryStyles(resolved.color);
  const finance = pricedTaskFinance(tasks);
  const recentMoves = recordedMovements(data.movements).filter((item) => item.projectId === projectId).slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader
        title={project.name}
        subtitle={[resolved.name, project.location, project.projectNumber, project.startDate ? formatProjectDate(project.startDate, locale) : ""].filter(Boolean).join(" · ") || project.clientName || t("common.project")}
        actions={
          <Link href={`/projects/${project.id}/print`} className="inline-flex h-10 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white">
            {t("projects.printCard")}
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge value={project.status} label={labelOf(project.status)} />
        <span className="text-slate-500">{resolved.name}</span>
        {project.location ? <span className="text-slate-500">{project.location}</span> : null}
        {project.projectNumber ? <span className="text-slate-500">{t("docs.number", { number: project.projectNumber })}</span> : null}
        {project.startDate ? <span className="text-slate-500">{t("common.start")} {formatProjectDate(project.startDate, locale)}</span> : null}
        <span className="text-slate-500">{t("projects.manager", { name: employeeName(data.employees, project.managerEmployeeId) })}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-xl px-3 py-2 text-sm ${tab === item.id ? "bg-[var(--brand-primary)] text-white" : "bg-white text-slate-600"}`}>
            {t(item.key)}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard title={t("common.description")}>
            <p className="text-sm leading-6 text-slate-600">{project.description || t("projects.noDescription")}</p>
          </SectionCard>
          <SectionCard title={t("common.progress")}>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: styles.progress }} />
            </div>
            <p className="mt-3 text-sm text-slate-500">{t("projects.overviewStats", {
              progress: String(progress),
              hours: String(hours),
              open: String(tasks.filter(taskIsActive).length),
              late: String(tasks.filter((task) => isOverdue(task, today)).length),
            })}</p>
          </SectionCard>
          {canViewFinance ? (
            <SectionCard title={t("finance.section")}>
              <p className="flex justify-between text-sm"><span>{t("finance.priced")}</span><span>{formatIls(finance.total)}</span></p>
              <p className="mt-1 flex justify-between text-sm"><span>{t("finance.received")}</span><span>{formatIls(finance.received)}</span></p>
              <p className="mt-1 flex justify-between text-sm font-medium"><span>{t("finance.open")}</span><span>{formatIls(finance.open)}</span></p>
              {recentMoves.length ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-medium text-slate-500">{t("finance.recent")}</p>
                  {recentMoves.map((item) => (
                    <p key={item.id} className="flex justify-between py-1 text-sm">
                      <span>{item.date} · {item.description || (item.type === "INCOME" ? t("move.income") : t("move.expense"))}</span>
                      <span>{formatIls(item.amount)}</span>
                    </p>
                  ))}
                </div>
              ) : null}
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {tab === "tasks" ? (
        <SectionCard title={t("work.tabTasks")}>
          {tasks.length ? (
            <div className="grid gap-4">
              {openTasks.length ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500">{t("work.kpiOpen")}</p>
                  {openTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between border-t border-slate-100 py-2 first:border-0">
                      <div>
                        <p className="text-sm font-medium">○ {task.title}</p>
                        <p className="text-xs text-slate-500">{employeeName(data.employees, task.assigneeId)}</p>
                      </div>
                      <StatusBadge value={task.status} label={labelOf(task.status)} />
                    </div>
                  ))}
                </div>
              ) : null}
              {doneTasks.length ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500">{t("work.completedCount")}</p>
                  {doneTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between border-t border-slate-100 py-2 first:border-0">
                      <div>
                        <p className="text-sm font-medium">✓ {task.title}</p>
                        <p className="text-xs text-slate-500">{employeeName(data.employees, task.assigneeId)}</p>
                      </div>
                      <StatusBadge value={task.status} label={labelOf(task.status)} />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : <EmptyState icon={ClipboardList} title={t("projects.noProjectTasks")} />}
        </SectionCard>
      ) : null}

      {tab === "hours" ? (
        <SectionCard title={t("common.hours")}>
          {tasks.length ? tasks.map((task) => (
            <p key={task.id} className="border-t border-slate-100 py-2 text-sm first:border-0">{task.title}: {t("projects.hoursLine", { hours: String(actualHoursForTask(data.sessions, task.id)) })}</p>
          )) : <EmptyState icon={ClipboardList} title={t("projects.noHours")} />}
        </SectionCard>
      ) : null}

      {tab === "documents" ? (
        <SectionCard title={t("nav.documents")} action={<Link className="text-sm text-[var(--brand-primary)]" href="/documents">{t("projects.allDocuments")}</Link>}>
          {data.businessDocs.filter((item) => item.projectId === project.id).map((item) => (
            <Link key={item.id} href={`/documents/${item.id}`} className="block border-t border-slate-100 py-2 text-sm first:border-0">
              {item.number} · {item.title}
            </Link>
          ))}
          {docs.length ? docs.map((doc) => (
            <p key={doc.id} className="border-t border-slate-100 py-2 text-sm first:border-0">{doc.name}</p>
          )) : null}
          {!docs.length && !data.businessDocs.some((item) => item.projectId === project.id) ? <EmptyState icon={FileArchive} title={t("projects.noDocuments")} /> : null}
        </SectionCard>
      ) : null}

      {tab === "team" ? (
        <SectionCard title={t("common.team")}>
          {teamIds.length ? teamIds.map((id) => (
            <p key={id} className="border-t border-slate-100 py-2 text-sm first:border-0">{employeeName(data.employees, id)}</p>
          )) : <EmptyState icon={Users} title={t("projects.noTeam")} />}
        </SectionCard>
      ) : null}

      {tab === "activity" ? (
        <SectionCard title={t("dashboard.recentActivity")}>
          {data.activity.filter((item) => item.entityId === project.id || tasks.some((task) => task.id === item.entityId)).length
            ? data.activity.filter((item) => item.entityId === project.id || tasks.some((task) => task.id === item.entityId)).map((item) => (
              <p key={item.id} className="border-t border-slate-100 py-2 text-sm first:border-0">{item.message}</p>
            ))
            : <EmptyState icon={ClipboardList} title={t("projects.noActivity")} />}
        </SectionCard>
      ) : null}
    </div>
  );
}
