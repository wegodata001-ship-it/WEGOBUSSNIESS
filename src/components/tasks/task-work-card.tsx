"use client";

import { MessageCircle } from "lucide-react";
import { CollaboratorAvatars } from "@/components/admin/employee-multi-select";
import { StatusBadge } from "@/components/admin/ui";
import { employeeName } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { isOverdue } from "@/lib/admin/time";
import { taskParticipantIds } from "@/lib/admin/task-team";
import type { Department, Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import type { Task } from "@/types/task";

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-rose-500",
  HIGH: "bg-orange-500",
  NORMAL: "bg-sky-500",
  LOW: "bg-slate-400",
};

export function TaskWorkCard({
  task,
  employees,
  today,
  onOpen,
}: {
  task: Task;
  employees: Employee[];
  departments?: Department[];
  projects?: Project[];
  today: string;
  onOpen: () => void;
}) {
  const people = taskParticipantIds(task);
  const overdue = isOverdue(task, today);
  const when = [task.startDate || task.scheduledDate || task.dueDate, task.startTime && task.endTime ? `${task.startTime}–${task.endTime}` : task.startTime]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-[#E2E8F0] bg-white p-4 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority] || "bg-sky-500"}`} />
          {labelOf(task.priority)}
        </span>
        <StatusBadge value={overdue ? "OVERDUE" : task.status} label={overdue ? "באיחור" : labelOf(task.status)} />
      </div>
      <p className="mt-2 text-sm font-semibold text-[#0F172A]">{task.title}</p>
      {when ? <p className="mt-1 text-xs text-slate-500">{when}</p> : null}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CollaboratorAvatars employees={employees} ids={people} />
          {people.length ? (
            <span className="text-[11px] text-slate-500">{people.map((id) => employeeName(employees, id)).slice(0, 2).join(", ")}</span>
          ) : null}
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <MessageCircle className="h-3.5 w-3.5" />
          {task.commentCount || 0}
        </span>
      </div>
    </button>
  );
}
