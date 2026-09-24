"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { employeeName, sessionHours, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { actualHoursForTask, isOverdue, taskIsActive } from "@/lib/admin/time";
import { todayInTimeZone } from "@/lib/dates/format";
import { ClipboardList, FileArchive, Users } from "lucide-react";

const TABS = ["סקירה", "משימות", "שעות", "מסמכים", "צוות", "פעילות"] as const;

export function ProjectWorkspace() {
  const params = useParams<{ projectId: string }>();
  const { business } = useBusinessContext();
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("סקירה");
  const today = todayInTimeZone(business?.timezone);
  const project = data.projects.find((item) => item.id === params.projectId);

  const tasks = useMemo(() => data.tasks.filter((task) => task.projectId === params.projectId), [data.tasks, params.projectId]);
  const docs = data.documents.filter((item) => item.projectId === params.projectId);
  const hours = sessionHours(data.sessions.filter((session) => tasks.some((task) => task.id === session.taskId)));
  const teamIds = [...new Set(tasks.flatMap((task) => [task.assigneeId, ...task.collaboratorIds].filter(Boolean)))] as string[];

  if (loading) return <Spinner label="טוען פרויקט…" />;
  if (!project) return <EmptyState icon={ClipboardList} title="הפרויקט לא נמצא" />;

  const done = tasks.filter((task) => task.status === "DONE" || task.status === "COMPLETED").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={project.name}
        subtitle={[project.category, project.location, project.projectNumber, project.startDate].filter(Boolean).join(" · ") || project.clientName || "פרויקט"}
        actions={
          <Link href={`/projects/${project.id}/print`} className="inline-flex h-10 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white">
            הפק כרטסת פרויקט
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge value={project.status} label={labelOf(project.status)} />
        {project.category ? <span className="text-slate-500">{project.category}</span> : null}
        {project.location ? <span className="text-slate-500">{project.location}</span> : null}
        {project.projectNumber ? <span className="text-slate-500">מס׳ {project.projectNumber}</span> : null}
        {project.startDate ? <span className="text-slate-500">התחלה {project.startDate}</span> : null}
        <span className="text-slate-500">מנהל: {employeeName(data.employees, project.managerEmployeeId)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-xl px-3 py-2 text-sm ${tab === item ? "bg-[var(--brand-primary)] text-white" : "bg-white text-slate-600"}`}>
            {item}
          </button>
        ))}
      </div>

      {tab === "סקירה" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard title="תיאור">
            <p className="text-sm leading-6 text-slate-600">{project.description || "אין תיאור לפרויקט זה."}</p>
          </SectionCard>
          <SectionCard title="התקדמות">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-[var(--brand-primary)]" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-sm text-slate-500">{progress}% · {hours} שעות · {tasks.filter(taskIsActive).length} משימות פתוחות · {tasks.filter((task) => isOverdue(task, today)).length} באיחור</p>
          </SectionCard>
        </div>
      ) : null}

      {tab === "משימות" ? (
        <SectionCard title="משימות">
          {tasks.length ? tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between border-t border-slate-100 py-2 first:border-0">
              <div>
                <p className="text-sm font-medium">{task.title}</p>
                <p className="text-xs text-slate-500">{employeeName(data.employees, task.assigneeId)}</p>
              </div>
              <StatusBadge value={task.status} label={labelOf(task.status)} />
            </div>
          )) : <EmptyState icon={ClipboardList} title="אין משימות לפרויקט" />}
        </SectionCard>
      ) : null}

      {tab === "שעות" ? (
        <SectionCard title="שעות">
          {tasks.length ? tasks.map((task) => (
            <p key={task.id} className="border-t border-slate-100 py-2 text-sm first:border-0">{task.title}: {actualHoursForTask(data.sessions, task.id)} שעות</p>
          )) : <EmptyState icon={ClipboardList} title="אין שעות משויכות" />}
        </SectionCard>
      ) : null}

      {tab === "מסמכים" ? (
        <SectionCard title="מסמכים" action={<Link className="text-sm text-[var(--brand-primary)]" href="/documents">לארכיון</Link>}>
          {docs.length ? docs.map((doc) => (
            <p key={doc.id} className="border-t border-slate-100 py-2 text-sm first:border-0">{doc.name}</p>
          )) : <EmptyState icon={FileArchive} title="אין מסמכים לפרויקט" />}
        </SectionCard>
      ) : null}

      {tab === "צוות" ? (
        <SectionCard title="צוות">
          {teamIds.length ? teamIds.map((id) => (
            <p key={id} className="border-t border-slate-100 py-2 text-sm first:border-0">{employeeName(data.employees, id)}</p>
          )) : <EmptyState icon={Users} title="אין צוות משויך עדיין" />}
        </SectionCard>
      ) : null}

      {tab === "פעילות" ? (
        <SectionCard title="פעילות אחרונה">
          {data.activity.filter((item) => item.entityId === project.id || tasks.some((task) => task.id === item.entityId)).length
            ? data.activity.filter((item) => item.entityId === project.id || tasks.some((task) => task.id === item.entityId)).map((item) => (
              <p key={item.id} className="border-t border-slate-100 py-2 text-sm first:border-0">{item.message}</p>
            ))
            : <EmptyState icon={ClipboardList} title="אין פעילות לפרויקט" />}
        </SectionCard>
      ) : null}
    </div>
  );
}
