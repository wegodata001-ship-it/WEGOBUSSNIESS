"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { EmployeeAvatar } from "@/components/admin/employee-multi-select";
import { GhostButton, PrimaryButton, StatusBadge } from "@/components/admin/ui";
import { departmentName, employeeName, projectName } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { clockLabel, relativeTimeLabel } from "@/lib/admin/relative-time";
import { taskParticipantIds } from "@/lib/admin/task-team";
import { changeBusinessTaskStatus, decideBusinessTask, fetchTaskThread, postTaskComment } from "@/lib/business/api";
import { reviveSessionDates } from "@/lib/session/serialize";
import type { Department, Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import type { Task, TaskActivity, TaskComment } from "@/types/task";
import { isPendingApproval } from "@/types/task";

export function TaskDetailDrawer({
  task,
  employees,
  departments,
  projects,
  canManage,
  canChat,
  businessId,
  currentEmployeeId,
  openChat,
  onClose,
  onChanged,
}: {
  task: Task;
  employees: Employee[];
  departments: Department[];
  projects: Project[];
  canManage: boolean;
  canChat: boolean;
  businessId: string;
  currentEmployeeId: string | null;
  openChat?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const people = taskParticipantIds(task);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function loadThread() {
      const result = await fetchTaskThread(businessId, task.id);
      if (!active || !result.ok) return;
      setComments(reviveSessionDates(result.comments ?? []));
      setActivity(reviveSessionDates(result.activity ?? []));
    }
    void loadThread();
    const timer = window.setInterval(() => void loadThread(), 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [businessId, task.id]);

  useEffect(() => {
    if (openChat) chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [openChat, comments.length]);

  const mentionOptions = useMemo(() => {
    const q = body.split("@").pop()?.trim().toLowerCase() ?? "";
    return employees.filter((employee) => people.includes(employee.id) && employee.displayName.toLowerCase().includes(q));
  }, [body, employees, people]);

  function onBodyChange(value: string) {
    setBody(value);
    setMentionOpen(value.endsWith("@") || /@[\u0590-\u05FFa-zA-Z0-9]*$/.test(value));
  }

  function addMention(employee: Employee) {
    const next = body.replace(/@[\u0590-\u05FFa-zA-Z0-9]*$/, `@${employee.displayName} `);
    setBody(next);
    setMentions((current) => current.includes(employee.id) ? current : [...current, employee.id]);
    setMentionOpen(false);
  }

  async function send() {
    if (!body.trim() || !canChat) return;
    setBusy(true);
    const mentioned = mentions.filter((id) => {
      const name = employeeName(employees, id);
      return body.includes(`@${name}`);
    });
    const result = await postTaskComment({ businessId, taskId: task.id, body: body.trim(), mentions: mentioned });
    setBusy(false);
    if (!result.ok) return;
    setBody("");
    setMentions([]);
    const thread = await fetchTaskThread(businessId, task.id);
    if (thread.ok) {
      setComments(reviveSessionDates(thread.comments ?? []));
      setActivity(reviveSessionDates(thread.activity ?? []));
    }
    onChanged();
  }

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    const result = await decideBusinessTask({
      businessId,
      id: task.id,
      action,
      reason: action === "reject" ? reason : undefined,
    });
    setBusy(false);
    if (!result.ok) return;
    setRejectOpen(false);
    onChanged();
    onClose();
  }

  async function setStatus(status: string) {
    setBusy(true);
    await changeBusinessTaskStatus({ businessId, id: task.id, status });
    setBusy(false);
    onChanged();
  }

  const timeline = [
    ...activity.map((item) => ({
      id: `a-${item.id}`,
      kind: "activity" as const,
      at: item.createdAt,
      name: employeeName(employees, item.actorEmployeeId) !== "לא משויך"
        ? employeeName(employees, item.actorEmployeeId)
        : "מערכת",
      text: item.message,
    })),
    ...comments.map((item) => ({
      id: `c-${item.id}`,
      kind: "comment" as const,
      at: item.createdAt,
      name: employeeName(employees, item.authorEmployeeId),
      text: item.body,
    })),
  ].sort((left, right) => (left.at?.getTime() ?? 0) - (right.at?.getTime() ?? 0));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <button type="button" className="h-full flex-1" aria-label="סגירה" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[#0F172A]">{task.title}</h2>
              <StatusBadge value={task.status} label={labelOf(task.status)} />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {projectName(projects, task.projectId)} · {departmentName(departments, task.departmentId)} · {labelOf(task.priority)}
            </p>
            <p className="mt-1 text-sm text-slate-500" dir="ltr">
              {task.startDate || task.scheduledDate || ""} {task.startTime || ""}{task.endTime ? ` - ${task.endTime}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-50" aria-label="סגירה">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <p className="text-xs font-medium text-slate-500">משתתפים</p>
            <div className="mt-2 space-y-2">
              {people.map((id) => (
                <div key={id} className="flex items-center gap-2 text-sm">
                  <EmployeeAvatar name={employeeName(employees, id)} />
                  {employeeName(employees, id)}
                  {id === currentEmployeeId ? <span className="text-xs text-slate-400">את/ה</span> : null}
                </div>
              ))}
            </div>
          </section>

          {task.description ? (
            <section>
              <p className="text-xs font-medium text-slate-500">תיאור המשימה</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{task.description}</p>
            </section>
          ) : null}

          {isPendingApproval(task.status) && canManage ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">ממתינה לאישור מנהל</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <PrimaryButton disabled={busy} onClick={() => void decide("approve")}>✓ אישור</PrimaryButton>
                <GhostButton disabled={busy} onClick={() => setRejectOpen(true)}>✕ דחייה</GhostButton>
              </div>
              {rejectOpen ? (
                <div className="mt-3 space-y-2">
                  <textarea className="h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="סיבת דחייה" />
                  <PrimaryButton disabled={busy} onClick={() => void decide("reject")}>אישור דחייה</PrimaryButton>
                </div>
              ) : null}
            </section>
          ) : null}

          {!isPendingApproval(task.status) && task.status !== "REJECTED" ? (
            <div className="flex flex-wrap gap-2">
              {task.status !== "IN_PROGRESS" ? <GhostButton disabled={busy} onClick={() => void setStatus("IN_PROGRESS")}>בביצוע</GhostButton> : null}
              {task.status !== "WAITING" ? <GhostButton disabled={busy} onClick={() => void setStatus("WAITING")}>בהמתנה</GhostButton> : null}
              {task.status !== "COMPLETED" && task.status !== "DONE" ? <GhostButton disabled={busy} onClick={() => void setStatus("COMPLETED")}>הושלמה</GhostButton> : null}
            </div>
          ) : null}

          <section ref={chatRef}>
            <p className="text-xs font-medium text-slate-500">פעילות ושיחה</p>
            <div className="mt-3 space-y-3">
              {timeline.length ? timeline.map((item) => (
                <div key={item.id} className={item.kind === "activity" ? "text-xs text-slate-500" : "rounded-2xl bg-slate-50 px-3 py-2"}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">{item.name}</span>
                    <span className="text-[11px] text-slate-400">{clockLabel(item.at)} · {relativeTimeLabel(item.at)}</span>
                  </div>
                  <p className={item.kind === "comment" ? "mt-1 text-sm text-slate-800" : "mt-0.5"}>{item.text}</p>
                </div>
              )) : (
                <p className="text-sm text-slate-400">אין פעילות עדיין</p>
              )}
            </div>
          </section>
        </div>

        {canChat ? (
          <div className="relative border-t border-slate-100 p-4">
            {mentionOpen && mentionOptions.length ? (
              <div className="absolute inset-x-4 bottom-full mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                {mentionOptions.slice(0, 6).map((employee) => (
                  <button key={employee.id} type="button" onClick={() => addMention(employee)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-slate-50">
                    <EmployeeAvatar name={employee.displayName} />
                    {employee.displayName}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                value={body}
                onChange={(event) => onBodyChange(event.target.value)}
                placeholder="כתוב תגובה... השתמשו ב-@ לתיוג"
                className="h-20 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
              />
              <PrimaryButton disabled={busy || !body.trim()} onClick={() => void send()}>
                <Send className="h-4 w-4" />
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
