"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, Paperclip, Send, X } from "lucide-react";
import { EmployeeAvatar } from "@/components/admin/employee-multi-select";
import { GhostButton, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { departmentName, employeeName, projectName } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { dateTimeLabel, relativeTimeLabel } from "@/lib/admin/relative-time";
import { taskFileErrorKey } from "@/lib/admin/task-file-rules";
import { taskParticipantIds } from "@/lib/admin/task-team";
import { PaymentModal } from "@/components/tasks/payment-modal";
import { PaymentStatusBadge } from "@/components/tasks/payment-status-badge";
import { TaskFilesPanel } from "@/components/tasks/task-files-panel";
import {
  changeBusinessTaskStatus,
  decideBusinessTask,
  deleteTaskComment,
  editTaskComment,
  fetchTaskAttachments,
  fetchTaskLinks,
  fetchTaskPayments,
  fetchTaskThread,
  markTaskThreadRead,
  postTaskComment,
  saveTaskPrice,
  uploadTaskAttachments,
  voidBusinessPayment,
} from "@/lib/business/api";
import {
  calculateEnteredPriceWithVat,
  resolveProjectBaseVatMode,
  type ProjectBaseVatMode,
} from "@/lib/finance/vat";
import { formatIls, parseMoney } from "@/lib/finance/money";
import { reviveSessionDates } from "@/lib/session/serialize";
import type { Department, Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import type { PaymentRecord } from "@/types/payment";
import type { Task, TaskActivity, TaskAttachment, TaskComment, TaskLink } from "@/types/task";
import { isDoneTaskStatus, isPendingApproval } from "@/types/task";
import { useI18n } from "@/components/providers/i18n-provider";

type TabId = "details" | "files" | "chat" | "activity";

export function TaskDetailDrawer({
  task,
  employees,
  departments,
  projects,
  canManage,
  canViewFinance = false,
  canSetPrice = false,
  canReceivePayment = false,
  vatRate,
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
  canViewFinance?: boolean;
  canSetPrice?: boolean;
  canReceivePayment?: boolean;
  vatRate: number;
  canChat: boolean;
  businessId: string;
  currentEmployeeId: string | null;
  openChat?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const people = taskParticipantIds(task);
  const [tab, setTab] = useState<TabId>(openChat ? "chat" : "details");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [chatLink, setChatLink] = useState("");
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [priceDraft, setPriceDraft] = useState(() => {
    const mode = resolveProjectBaseVatMode(task.priceVatMode);
    if (mode === "INCLUDING_VAT") {
      return task.priceIncludingVat == null ? "" : String(task.priceIncludingVat);
    }
    return task.priceBeforeVat == null ? "" : String(task.priceBeforeVat);
  });
  const [priceVatMode, setPriceVatMode] = useState<ProjectBaseVatMode>(() => resolveProjectBaseVatMode(task.priceVatMode));
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadAssets = useCallback(async () => {
    const [files, urls] = await Promise.all([
      fetchTaskAttachments(businessId, task.id),
      fetchTaskLinks(businessId, task.id),
    ]);
    setAttachments(reviveSessionDates(files.attachments ?? []));
    setLinks(reviveSessionDates(urls.links ?? []));
  }, [businessId, task.id]);

  useEffect(() => {
    let active = true;
    async function loadThread() {
      const result = await fetchTaskThread(businessId, task.id);
      if (!active || !result.ok) return;
      setComments(reviveSessionDates(result.comments ?? []));
      setActivity(reviveSessionDates(result.activity ?? []));
      setUnreadCount(typeof result.unreadCount === "number" ? result.unreadCount : 0);
    }
    async function loadPayments() {
      if (!canViewFinance) return;
      const result = await fetchTaskPayments(businessId, task.id);
      if (!active || !result.ok) return;
      setPayments(reviveSessionDates(result.data));
    }
    void loadThread();
    void loadPayments();
    void loadAssets();
    const timer = window.setInterval(() => {
      void loadThread();
      void loadPayments();
      void loadAssets();
    }, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [businessId, canViewFinance, task.id]);

  useEffect(() => {
    const mode = resolveProjectBaseVatMode(task.priceVatMode);
    setPriceVatMode(mode);
    if (mode === "INCLUDING_VAT") {
      setPriceDraft(task.priceIncludingVat == null ? "" : String(task.priceIncludingVat));
    } else {
      setPriceDraft(task.priceBeforeVat == null ? "" : String(task.priceBeforeVat));
    }
  }, [task.priceBeforeVat, task.priceIncludingVat, task.priceVatMode]);

  useEffect(() => {
    if (openChat) setTab("chat");
  }, [openChat]);

  useEffect(() => {
    if (tab === "chat") {
      void markTaskThreadRead(businessId, task.id).then(() => setUnreadCount(0));
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [businessId, task.id, tab, comments.length]);

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
    if (!canChat || (!body.trim() && !chatFiles.length && !chatLink.trim())) return;
    setBusy(true);
    const mentioned = mentions.filter((id) => {
      const name = employeeName(employees, id);
      return body.includes(`@${name}`);
    });
    const uploaded: Array<{ id: string; name: string }> = [];
    const leftover: File[] = [];
    setChatError("");
    if (chatFiles.length) {
      for (const file of chatFiles) {
        const uploadedFile = await uploadTaskAttachments({ businessId, taskId: task.id, files: [file] });
        if (uploadedFile.ok && uploadedFile.ids[0]) {
          uploaded.push({ id: uploadedFile.ids[0], name: file.name });
        } else {
          leftover.push(file);
          setChatError(t(taskFileErrorKey(uploadedFile.error)));
        }
      }
      setChatFiles(leftover);
    }
    if (!editingId && !body.trim() && !uploaded.length && !chatLink.trim()) {
      setBusy(false);
      return;
    }
    const result = editingId
      ? await editTaskComment({ businessId, taskId: task.id, commentId: editingId, body: body.trim() })
      : await postTaskComment({
        businessId,
        taskId: task.id,
        body: body.trim(),
        mentions: mentioned,
        attachments: uploaded,
        linkUrl: chatLink.trim() || null,
        linkTitle: chatLink.trim() || null,
      });
    setBusy(false);
    if (!result.ok) return;
    setBody("");
    setMentions([]);
    setChatFiles(leftover);
    setChatLink("");
    setEditingId(null);
    const thread = await fetchTaskThread(businessId, task.id);
    if (thread.ok) {
      setComments(reviveSessionDates(thread.comments ?? []));
      setActivity(reviveSessionDates(thread.activity ?? []));
    }
    await loadAssets();
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

  const visibleComments = comments.filter((item) => !item.deletedAt || item.authorUserId);
  const tabs: Array<{ id: TabId; label: string; badge?: number }> = [
    { id: "details", label: t("work.tabDetails") },
    { id: "files", label: t("work.tabFiles"), badge: attachments.length + links.length || undefined },
    { id: "chat", label: t("work.tabChat"), badge: unreadCount || undefined },
    { id: "activity", label: t("work.tabActivity") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <button type="button" className="hidden h-full flex-1 sm:block" aria-label={t("common.close")} onClick={onClose} />
      <aside className="flex h-full w-full max-w-full flex-col bg-white shadow-2xl sm:max-w-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="whitespace-pre-wrap text-lg font-semibold text-[#0F172A]">{task.title}</h2>
              <StatusBadge value={task.status} label={labelOf(task.status)} />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {projectName(projects, task.projectId)} · {departmentName(departments, task.departmentId)} · {labelOf(task.priority)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-50" aria-label={t("common.close")}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`relative min-h-11 shrink-0 px-3 text-sm font-medium ${tab === item.id ? "text-[var(--brand-primary)]" : "text-slate-500"}`}
            >
              {item.label}
              {item.badge ? <span className="ms-1 rounded-full bg-slate-900 px-1.5 text-[10px] text-white">{item.badge}</span> : null}
              {tab === item.id ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--brand-primary)]" /> : null}
            </button>
          ))}
        </div>

        <div className={`min-h-0 flex-1 ${tab === "chat" ? "flex flex-col" : "overflow-y-auto"} px-4 py-4 sm:px-6`}>
          {tab === "details" ? (
            <div className="space-y-5">
              <section className="space-y-1 text-sm text-slate-600">
                <p className="flex justify-between gap-3"><span>{t("common.project")}</span><span>{projectName(projects, task.projectId)}</span></p>
                <p className="flex justify-between gap-3"><span>{t("common.assignee")}</span><span>{employeeName(employees, task.assigneeId)}</span></p>
                <p className="flex justify-between gap-3"><span>{t("common.status")}</span><span>{labelOf(task.status)}</span></p>
                <p className="flex justify-between gap-3"><span>{t("common.priority")}</span><span>{labelOf(task.priority)}</span></p>
                {task.estimatedHours != null ? <p className="flex justify-between gap-3"><span>{t("work.plannedHours")}</span><span>{task.estimatedHours}</span></p> : null}
                {task.startDate ? <p className="flex justify-between gap-3"><span>{t("common.start")}</span><span>{task.startDate}{task.startTime ? ` ${task.startTime}` : ""}</span></p> : null}
                {task.dueDate ? <p className="flex justify-between gap-3"><span>{t("common.deadline")}</span><span>{task.dueDate}</span></p> : null}
                {task.completedDate ? <p className="flex justify-between gap-3"><span>{t("common.done")}</span><span>{task.completedDate}</span></p> : null}
                {task.legacyCategory ? <p className="flex justify-between gap-3"><span>{t("common.category")}</span><span>{task.legacyCategory}</span></p> : null}
                <p className="flex justify-between gap-3"><span>{t("work.approvalStatus")}</span><span>{task.legacyApprovalStatus === "PENDING" ? t("status.PENDING_APPROVAL") : task.legacyApprovalStatus === "APPROVED" ? t("status.APPROVED") : isPendingApproval(task.status) ? t("status.PENDING_APPROVAL") : "—"}</span></p>
                {task.createdAt ? <p className="flex justify-between gap-3"><span>{t("common.created")}</span><span>{dateTimeLabel(task.createdAt)}</span></p> : null}
              </section>

              <section>
                <p className="text-xs font-medium text-slate-500">{t("work.participants")}</p>
                <div className="mt-2 space-y-2">
                  {people.map((id) => (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      <EmployeeAvatar name={employeeName(employees, id)} />
                      {employeeName(employees, id)}
                      {id === currentEmployeeId ? <span className="text-xs text-slate-400">{t("work.you")}</span> : null}
                    </div>
                  ))}
                  {task.legacyAssignee ? <p className="text-xs text-slate-400" dir="ltr">{task.legacyAssignee}</p> : null}
                </div>
              </section>

              {canViewFinance ? (
                <section className="rounded-2xl border border-slate-200 p-3">
                  <p className="text-xs font-medium text-slate-500">{t("work.finance")}</p>
                  {canSetPrice ? (
                    <>
                      <label className="mt-2 block text-sm">
                        <span className="mb-1 block text-slate-600">{t("finance.taskAmount")}</span>
                        <input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={priceDraft} onChange={(event) => setPriceDraft(event.target.value)} />
                      </label>
                      <div className="mt-2 flex flex-col gap-2 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`task-detail-vat-mode-${task.id}`}
                            checked={priceVatMode === "INCLUDING_VAT"}
                            onChange={() => setPriceVatMode("INCLUDING_VAT")}
                          />
                          {t("finance.vatModeIncluding")}
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`task-detail-vat-mode-${task.id}`}
                            checked={priceVatMode === "EXCLUDING_VAT"}
                            onChange={() => setPriceVatMode("EXCLUDING_VAT")}
                          />
                          {t("finance.vatModeExcluding")}
                        </label>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm">{task.priceBeforeVat === null ? t("work.noPrice") : formatIls(task.priceBeforeVat)}</p>
                  )}
                  {(() => {
                    const next = parseMoney(priceDraft);
                    const preview = next === null ? null : calculateEnteredPriceWithVat(next, vatRate, priceVatMode);
                    const shown = task.priceIncludingVat === null && !preview ? null : preview ?? {
                      priceBeforeVat: task.priceBeforeVat ?? 0,
                      vatAmount: task.vatAmount ?? 0,
                      priceIncludingVat: task.priceIncludingVat ?? 0,
                    };
                    return shown ? (
                      <div className="mt-2 space-y-1 text-sm text-slate-600">
                        <p className="flex justify-between"><span>{t("finance.beforeVat")}</span><span>{formatIls(shown.priceBeforeVat)}</span></p>
                        <p className="flex justify-between"><span>{t("work.vat")}</span><span>{formatIls(shown.vatAmount)}</span></p>
                        <p className="flex justify-between"><span>{t("work.priceTotal")}</span><span>{formatIls(shown.priceIncludingVat)}</span></p>
                        <p className="flex justify-between"><span>{t("work.paid")}</span><span>{formatIls(task.paidAmount)}</span></p>
                        <p className="flex justify-between"><span>{t("work.balance")}</span><span>{formatIls(task.balanceDue)}</span></p>
                        <PaymentStatusBadge status={task.paymentStatus} />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-400">{t("work.noPrice")}</p>
                    );
                  })()}
                  {isDoneTaskStatus(task.status) && (task.balanceDue ?? 0) > 0 ? (
                    <p className="mt-2 text-sm text-amber-700">{t("work.doneBalance", { amount: formatIls(task.balanceDue) })}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canSetPrice ? (
                      <GhostButton disabled={busy} onClick={() => {
                        const next = parseMoney(priceDraft);
                        if (next === null) return;
                        setBusy(true);
                        void saveTaskPrice({
                          businessId,
                          taskId: task.id,
                          priceBeforeVat: next,
                          vatMode: priceVatMode,
                        }).then(() => {
                          setBusy(false);
                          onChanged();
                        });
                      }}>{t("work.savePrice")}</GhostButton>
                    ) : null}
                    {canReceivePayment && (task.balanceDue ?? 0) > 0 ? (
                      <PrimaryButton onClick={() => setPayOpen(true)}>{t("work.receivePayment")}</PrimaryButton>
                    ) : null}
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-medium text-slate-500">{t("work.paymentHistory")}</p>
                    {payments.length ? payments.map((payment) => {
                      const allocated = payment.allocations.find((item) => item.taskId === task.id)?.amount ?? payment.amount;
                      const [year, month, day] = payment.paymentDate.split("-");
                      const displayDate = year && month && day ? `${day}/${month}/${year}` : payment.paymentDate;
                      return (
                        <div key={payment.id} className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                          <p className="font-medium">{displayDate}</p>
                          <p>{formatIls(allocated)}</p>
                          <p className="text-xs text-slate-500">
                            {labelOf(payment.paymentMethod)}
                            {payment.reference ? ` · ${t("work.reference", { ref: payment.reference })}` : ""}
                            {payment.status === "VOIDED" ? ` · ${t("work.voided")}` : ""}
                          </p>
                          {payment.createdByEmployeeId ? (
                            <p className="text-xs text-slate-500">{employeeName(employees, payment.createdByEmployeeId)}</p>
                          ) : null}
                          {canSetPrice && payment.status === "RECORDED" ? (
                            <button
                              type="button"
                              className="mt-1 text-xs text-red-600"
                              onClick={() => {
                                const reasonText = window.prompt(t("work.voidReason")) ?? "";
                                if (!reasonText.trim()) return;
                                void voidBusinessPayment({ businessId, paymentId: payment.id, reason: reasonText }).then(onChanged);
                              }}
                            >
                              {t("work.voidRecord")}
                            </button>
                          ) : null}
                        </div>
                      );
                    }) : <p className="mt-2 text-sm text-slate-400">{t("work.noPayments")}</p>}
                    <p className="mt-2 flex justify-between text-sm"><span>{t("work.totalPaid")}</span><span>{formatIls(task.paidAmount)}</span></p>
                    <p className="flex justify-between text-sm"><span>{t("work.balance")}</span><span>{task.priceIncludingVat === null ? "—" : formatIls(task.balanceDue)}</span></p>
                  </div>
                </section>
              ) : null}

              {task.description ? (
                <section>
                  <p className="text-xs font-medium text-slate-500">{t("work.taskDescription")}</p>
                  <p className="mt-2 max-w-full whitespace-pre-wrap break-words text-sm leading-6 text-slate-700" dir="auto">{task.description}</p>
                </section>
              ) : (
                <section>
                  <p className="text-xs font-medium text-slate-500">{t("common.notes")}</p>
                  <p className="mt-2 text-sm text-slate-400">—</p>
                </section>
              )}

              {isPendingApproval(task.status) && canManage ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">{t("work.awaitingManager")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PrimaryButton disabled={busy} onClick={() => void decide("approve")}>{t("work.approve")}</PrimaryButton>
                    <GhostButton disabled={busy} onClick={() => setRejectOpen(true)}>{t("work.reject")}</GhostButton>
                  </div>
                  {rejectOpen ? (
                    <div className="mt-3 space-y-2">
                      <textarea className="h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("work.rejectReason")} />
                      <PrimaryButton disabled={busy} onClick={() => void decide("reject")}>{t("work.confirmReject")}</PrimaryButton>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {!isPendingApproval(task.status) && task.status !== "REJECTED" ? (
                <div className="flex flex-wrap gap-2">
                  {task.status !== "IN_PROGRESS" ? <GhostButton disabled={busy} onClick={() => void setStatus("IN_PROGRESS")}>{t("status.IN_PROGRESS")}</GhostButton> : null}
                  {task.status !== "WAITING" ? <GhostButton disabled={busy} onClick={() => void setStatus("WAITING")}>{t("status.WAITING")}</GhostButton> : null}
                  {task.status !== "COMPLETED" && task.status !== "DONE" ? <GhostButton disabled={busy} onClick={() => void setStatus("COMPLETED")}>{t("status.COMPLETED")}</GhostButton> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "files" ? (
            <TaskFilesPanel
              businessId={businessId}
              taskId={task.id}
              attachments={attachments}
              links={links}
              employees={employees}
              canChat={canChat}
              onChanged={() => { void loadAssets(); onChanged(); }}
            />
          ) : null}

          {tab === "chat" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={chatRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pe-1">
                {visibleComments.length ? visibleComments.map((item) => {
                  const mine = Boolean(currentEmployeeId && item.authorEmployeeId === currentEmployeeId);
                  const name = employeeName(employees, item.authorEmployeeId) !== t("common.unassigned")
                    ? employeeName(employees, item.authorEmployeeId)
                    : item.legacyAuthorEmail || t("common.unassigned");
                  const canDelete = canManage || mine;
                  return (
                    <div key={item.id} className={`max-w-[90%] rounded-2xl px-3 py-2 ${mine ? "ms-auto bg-sky-50" : "bg-slate-50"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <EmployeeAvatar name={name} />
                          <span className="font-medium text-slate-700">{name}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">{dateTimeLabel(item.createdAt) || relativeTimeLabel(item.createdAt)}</span>
                      </div>
                      {item.deletedAt ? (
                        <p className="mt-1 text-sm italic text-slate-400">{t("work.messageDeleted")}</p>
                      ) : (
                        <>
                          {item.body ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800" dir="auto">{item.body}</p> : null}
                          {item.editedAt ? <p className="text-[11px] text-slate-400">{t("work.edited")}</p> : null}
                          {item.linkUrl ? (
                            <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--brand-primary)]">
                              <Link2 className="h-3.5 w-3.5" /> {item.linkTitle || item.linkUrl}
                            </a>
                          ) : null}
                          {item.attachments.map((file) => (
                            <p key={`${item.id}-${file.name}`} className="mt-1 text-xs text-slate-500">{file.name}</p>
                          ))}
                          {mine || canDelete ? (
                            <div className="mt-2 flex gap-2 text-xs">
                              {mine && !item.deletedAt ? (
                                <button type="button" className="text-slate-500" onClick={() => { setEditingId(item.id); setBody(item.body); }}>{t("work.editMessage")}</button>
                              ) : null}
                              {canDelete && !item.deletedAt ? (
                                <button type="button" className="text-rose-600" onClick={() => void deleteTaskComment({ businessId, taskId: task.id, commentId: item.id }).then(() => {
                                  setComments((current) => current.map((comment) => comment.id === item.id ? { ...comment, deletedAt: new Date(), body: "" } : comment));
                                })}>{t("work.deleteMessage")}</button>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                }) : (
                  <p className="text-sm text-slate-400">{t("work.chatEmpty")}</p>
                )}
              </div>
              {canChat ? (
                <div className="relative mt-3 border-t border-slate-100 pt-3">
                  {mentionOpen && mentionOptions.length ? (
                    <div className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                      {mentionOptions.slice(0, 6).map((employee) => (
                        <button key={employee.id} type="button" onClick={() => addMention(employee)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-slate-50">
                          <EmployeeAvatar name={employee.displayName} />
                          {employee.displayName}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {chatError ? <p className="mb-2 text-xs text-rose-600">{chatError}</p> : null}
                  {chatFiles.length ? <p className="mb-2 text-xs text-slate-500">{chatFiles.map((file) => file.name).join(", ")}</p> : null}
                  <div className="mb-2 flex gap-2">
                    <input className={inputClass} dir="ltr" value={chatLink} onChange={(event) => setChatLink(event.target.value)} placeholder="https://" />
                  </div>
                  <div className="flex items-end gap-2">
                    <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => {
                      setChatFiles(Array.from(event.target.files ?? []));
                      event.target.value = "";
                    }} />
                    <GhostButton onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /></GhostButton>
                    <textarea
                      value={body}
                      onChange={(event) => onBodyChange(event.target.value)}
                      placeholder={t("work.commentPlaceholder")}
                      className="h-16 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                    />
                    <PrimaryButton disabled={busy || (!body.trim() && !chatFiles.length && !chatLink.trim())} onClick={() => void send()}>
                      <Send className="h-4 w-4" />
                    </PrimaryButton>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "activity" ? (
            <div className="space-y-3">
              {activity.length ? activity.map((item) => (
                <div key={item.id} className="border-s-2 border-slate-200 ps-3 text-sm">
                  <p className="font-medium text-slate-700">
                    {employeeName(employees, item.actorEmployeeId) !== t("common.unassigned")
                      ? employeeName(employees, item.actorEmployeeId)
                      : t("work.system")}
                  </p>
                  <p className="text-slate-600">{item.message}</p>
                  <p className="text-[11px] text-slate-400">{dateTimeLabel(item.createdAt) || relativeTimeLabel(item.createdAt)}</p>
                </div>
              )) : (
                <p className="text-sm text-slate-400">{t("work.noActivity")}</p>
              )}
            </div>
          ) : null}
        </div>
      </aside>
      {payOpen ? (
        <PaymentModal
          tasks={[task]}
          businessId={businessId}
          defaultDate={task.dueDate || new Date().toISOString().slice(0, 10)}
          onClose={() => setPayOpen(false)}
          onSaved={() => {
            setPayOpen(false);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
