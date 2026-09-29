"use client";

import { useParams } from "next/navigation";
import { useBusinessContext } from "@/components/providers/business-context";
import { Spinner } from "@/components/ui/spinner";
import { employeeName, sessionHours, useBusinessCatalog } from "@/lib/admin/catalog";
import { computeProjectProgress } from "@/lib/admin/project-progress";
import { labelOf } from "@/lib/admin/labels";
import { actualHoursForTask } from "@/lib/admin/time";
import { APP_NAME } from "@/lib/env";

export function ProjectPrint() {
  const params = useParams<{ projectId: string }>();
  const { business } = useBusinessContext();
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const project = data.projects.find((item) => item.id === params.projectId);
  const tasks = data.tasks.filter((task) => task.projectId === params.projectId);
  const teamIds = [...new Set(tasks.flatMap((task) => [task.assigneeId, ...task.collaboratorIds].filter(Boolean)))] as string[];
  const hours = sessionHours(data.sessions.filter((session) => tasks.some((task) => task.id === session.taskId)));

  if (loading) return <Spinner />;
  if (!project) return <p>הפרויקט לא נמצא</p>;

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-slate-400">{APP_NAME.toUpperCase()}</p>
          <h1 className="mt-1 text-2xl font-semibold">כרטסת פרויקט</h1>
        </div>
        <button type="button" onClick={() => window.print()} className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white print:hidden">
          Preview / Print / PDF
        </button>
      </div>
      <section className="mb-6 grid gap-2 text-sm">
        <p><strong>פרויקט:</strong> {project.name}</p>
        <p><strong>לקוח:</strong> {project.clientName || "—"}</p>
        <p><strong>סטטוס:</strong> {labelOf(project.status)}</p>
        <p><strong>התקדמות:</strong> {computeProjectProgress(tasks)}%</p>
        <p><strong>מנהל:</strong> {employeeName(data.employees, project.managerEmployeeId)}</p>
        <p><strong>תקופה:</strong> {project.startDate ?? "—"} – {project.dueDate ?? "—"}</p>
        <p><strong>תיאור:</strong> {project.description || "—"}</p>
      </section>
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">צוות</h2>
        <p className="text-sm">{teamIds.map((id) => employeeName(data.employees, id)).join(" · ") || "—"}</p>
      </section>
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">משימות וסטטוסים</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-start">
              <th className="py-2">משימה</th>
              <th>אחראי</th>
              <th>סטטוס</th>
              <th>שעות</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b border-slate-100">
                <td className="py-2">{task.title}</td>
                <td>{employeeName(data.employees, task.assigneeId)}</td>
                <td>{labelOf(task.status)}</td>
                <td>{actualHoursForTask(data.sessions, task.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-sm"><strong>סיכום שעות:</strong> {hours}</p>
    </div>
  );
}
