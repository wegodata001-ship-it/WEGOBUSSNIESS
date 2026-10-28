"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { CollaboratorAvatars } from "@/components/admin/employee-multi-select";
import { TaskFormModal, draftFromTask, emptyTaskDraft, taskDraftPayload, type TaskDraft } from "@/components/admin/task-form-modal";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, inputClass } from "@/components/admin/ui";
import { PaymentStatusBadge } from "@/components/tasks/payment-status-badge";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { PaymentModal } from "@/components/tasks/payment-modal";
import { PriceModal } from "@/components/tasks/price-modal";
import { TaskDetailDrawer } from "@/components/tasks/task-detail-drawer";
import { TaskWorkCard } from "@/components/tasks/task-work-card";
import { formatIls, money } from "@/lib/finance/money";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { changeBusinessTaskStatus, decideBusinessTask, mutateBusiness, saveBusinessTask, taskMutationMessage } from "@/lib/admin/api";
import { TaskPriorityPicker, TaskStatusPicker } from "@/components/tasks/task-inline-fields";
import { departmentName, employeeName, projectName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { statusDefinitionName } from "@/lib/admin/task-status-label";
import { filterStatusChips, taskMatchesStatusFilter } from "@/lib/admin/task-status-resolve";
import { isEmployeeOnTask, taskParticipantIds } from "@/lib/admin/task-team";
import { daysBetween, isArchivedTaskStatus, isOverdue } from "@/lib/admin/time";
import { todayInTimeZone } from "@/lib/dates/format";
import { startTask, finishTask } from "@/lib/tasks/actions";
import { displayTaskStatus, isDoneTaskStatus, isPendingApproval, TASK_PRIORITIES, type Task, type TaskPriority, type TaskStatus } from "@/types/task";

type TabId = "all" | "mine" | "shared" | "approval" | "progress" | "overdue" | "done";

export function TasksManageView() {
  const { t, locale } = useI18n();
  const { user, business, membership, permissions } = useBusinessContext();
  const membershipEmployeeId = membership?.employeeId ?? null;
  const canManage = permissions.includes("tasks.edit") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [departmentId, setDepartmentId] = useState(searchParams.get("departmentId") ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueFilter] = useState(searchParams.get("filter") ?? "");
  const [tab, setTab] = useState<TabId>(searchParams.get("tab") as TabId || (searchParams.get("filter") === "overdue" ? "overdue" : canManage ? "all" : "mine"));
  const [draft, setDraft] = useState<TaskDraft | null>(searchParams.get("new") === "1" ? emptyTaskDraft(today) : null);
  const [details, setDetails] = useState<Task | null>(null);
  const [openChat, setOpenChat] = useState(searchParams.get("chat") === "1");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, Partial<Task>>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [statusChip, setStatusChip] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkProjectOpen, setBulkProjectOpen] = useState(false);
  const [bulkProjectId, setBulkProjectId] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const canViewFinance = canManage || permissions.includes("finance.view") || permissions.includes("finance.receivePayment") || permissions.includes("finance.setPrice");
  const canReceivePayment = permissions.includes("finance.receivePayment") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canSetPrice = permissions.includes("finance.setPrice") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canSelectFinance = canSetPrice || canReceivePayment;
  const canSelectRows = canManage || canSelectFinance;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const id = searchParams.get("taskId");
    if (!id || !data.tasks.length) return;
    const found = tasks.find((task) => task.id === id);
    if (found) setDetails(found);
  }, [data.tasks, searchParams]);

  const pendingCount = data.tasks.filter((task) => isPendingApproval(task.status)).length;
  const tasks = useMemo(
    () => data.tasks.map((task) => (patches[task.id] ? { ...task, ...patches[task.id] } : task)),
    [data.tasks, patches],
  );

  const rows = useMemo(() => {
    return tasks.filter((task) => {
      const mine = isEmployeeOnTask(task, membershipEmployeeId) || task.createdByUserId === user.id;
      const shared = taskParticipantIds(task).length > 1;
      if (tab === "mine" && !mine) return false;
      if (tab === "shared" && !shared) return false;
      if (tab === "approval" && !isPendingApproval(task.status)) return false;
      if (tab === "progress" && task.status !== "IN_PROGRESS") return false;
      if (tab === "overdue" && !isOverdue(task, today)) return false;
      if (tab === "done" && task.status !== "COMPLETED" && task.status !== "DONE") return false;
      if (tab === "all" && isPendingApproval(task.status) && !canManage) return false;
      if (tab !== "approval" && tab !== "all" && isPendingApproval(task.status) && task.createdByUserId !== user.id) return false;
      if (!canManage && tab !== "approval" && isArchivedTaskStatus(task.status)) return false;
      if (query && !task.title.includes(query) && !task.description.includes(query)) return false;
      if (statusChip && !taskMatchesStatusFilter(task, statusChip, data.taskStatuses)) return false;
      if (status && task.status !== status) return false;
      if (priority && task.priority !== priority) return false;
      if (departmentId && task.departmentId !== departmentId) return false;
      if (employeeId && !isEmployeeOnTask(task, employeeId)) return false;
      if (projectId && task.projectId !== projectId) return false;
      if (dueFilter === "overdue" && !isOverdue(task, today)) return false;
      if (dueFilter === "dueToday" && task.dueDate !== today) return false;
      if (paymentStatus && task.paymentStatus !== paymentStatus) return false;
      if (minPrice && (task.priceBeforeVat ?? -1) < Number(minPrice)) return false;
      if (maxPrice && (task.priceBeforeVat ?? Number.POSITIVE_INFINITY) > Number(maxPrice)) return false;
      return true;
    });
  }, [canManage, data.taskStatuses, departmentId, dueFilter, employeeId, maxPrice, membershipEmployeeId, minPrice, paymentStatus, priority, projectId, query, status, statusChip, tab, tasks, today, user.id]);

  const selectedTasks = rows.filter((task) => selected.includes(task.id));
  const selectedUnpriced = selectedTasks.filter((task) => task.priceIncludingVat === null);
  const selectedPayable = selectedTasks.filter((task) => task.priceIncludingVat !== null && (task.balanceDue ?? 0) > 0);
  const selectedDue = money(selectedPayable.reduce((sum, task) => sum + (task.balanceDue ?? 0), 0));
  const financeSummary = {
    due: money(rows.reduce((sum, task) => sum + (task.priceIncludingVat ?? 0), 0)),
    paid: money(rows.reduce((sum, task) => sum + task.paidAmount, 0)),
    balance: money(rows.reduce((sum, task) => sum + (task.balanceDue ?? 0), 0)),
  };

  function toggleAll(checked: boolean) {
    setSelected(checked ? rows.map((task) => task.id) : []);
  }

  if (loading) return <Spinner label={t("common.loading")} />;

  async function save() {
    if (!business?.id || !draft?.title.trim()) return { ok: false as const };
    setBusy(true);
    setFormError(null);
    const result = await saveBusinessTask({
      businessId: business.id,
      id: draft.id,
      data: taskDraftPayload(draft),
    });
    setBusy(false);
    if (!result.ok) {
      setFormError(taskMutationMessage(result.error, t));
      return { ok: false as const };
    }
    if (!draft.id && result.id) setDraft({ ...draft, id: result.id });
    return { ok: true as const, id: result.id };
  }

  async function run(action: string, task: Task, extra?: Record<string, unknown>) {
    if (!business?.id) return;
    setBusy(true);
    try {
      if (action === "start") await startTask(business.id, task.id);
      else if (action === "finish") await finishTask(business.id, task.id);
      else await mutateBusiness({ businessId: business.id, action, id: task.id, data: extra });
      await reload({ silent: true });
    } catch (error) {
      const code = error instanceof Error ? error.message : "NETWORK";
      setToast(code === "FORBIDDEN" ? t("tasks.forbidden") : t("tasks.network"));
    } finally {
      setBusy(false);
    }
  }

  function patchTask(id: string, patch: Partial<Task> | null) {
    setPatches((current) => {
      if (!patch) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: { ...current[id], ...patch } };
    });
  }

  function canChangeStatus(task: Task) {
    if (isPendingApproval(task.status)) return canManage;
    return canManage || isEmployeeOnTask(task, membershipEmployeeId);
  }

  async function changeStatus(task: Task, status: TaskStatus, statusId?: string) {
    if (!business?.id) return;
    const previous = { status: task.status, statusId: task.statusId, completedAt: task.completedAt, completedByUserId: task.completedByUserId, completedDate: task.completedDate };
    const done = isDoneTaskStatus(status);
    patchTask(task.id, {
      status,
      statusId: statusId ?? task.statusId,
      completedAt: done && !isDoneTaskStatus(task.status) ? new Date() : done ? task.completedAt : null,
      completedByUserId: done && !isDoneTaskStatus(task.status) ? user.id : done ? task.completedByUserId : null,
      completedDate: done ? today : null,
    });
    setBusyId(task.id);
    const result = await changeBusinessTaskStatus({ businessId: business.id, id: task.id, status, statusId });
    setBusyId(null);
    if (!result.ok) {
      patchTask(task.id, previous);
      setToast(taskMutationMessage(result.error, t));
      return;
    }
    await reload({ silent: true });
    patchTask(task.id, null);
  }

  async function decideStatus(task: Task, action: "approve" | "reject") {
    if (!business?.id) return;
    const previous = { status: task.status };
    patchTask(task.id, { status: action === "approve" ? "TODO" : "REJECTED" });
    setBusyId(task.id);
    const result = await decideBusinessTask({ businessId: business.id, id: task.id, action });
    setBusyId(null);
    if (!result.ok) {
      patchTask(task.id, previous);
      setToast(taskMutationMessage(result.error, t));
      return;
    }
    await reload({ silent: true });
    patchTask(task.id, null);
  }

  async function changePriority(task: Task, priority: TaskPriority) {
    if (!business?.id) return;
    const previous = { priority: task.priority };
    patchTask(task.id, { priority });
    setBusyId(task.id);
    const result = await saveBusinessTask({
      businessId: business.id,
      id: task.id,
      data: {
        ...taskDraftPayload(draftFromTask(task, today)),
        status: isPendingApproval(task.status)
          ? "PENDING_APPROVAL"
          : task.status === "REJECTED"
            ? "REJECTED"
            : isDoneTaskStatus(task.status)
              ? "DONE"
              : displayTaskStatus(task.status),
        priority,
      },
    });
    setBusyId(null);
    if (!result.ok) {
      patchTask(task.id, previous);
      setToast(taskMutationMessage(result.error, t));
      return;
    }
    await reload({ silent: true });
    patchTask(task.id, null);
  }

  async function applyBulkStatus(statusId: string) {
    const def = data.taskStatuses.find((item) => item.id === statusId);
    if (!def) return;
    const logical = def.id === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : def.type === "COMPLETED" ? "COMPLETED" : def.type === "CANCELLED" ? "CANCELLED" : def.type === "IN_PROGRESS" ? "IN_PROGRESS" : def.type === "WAITING" ? "WAITING" : "TODO";
    for (const task of selectedTasks) {
      if (!canChangeStatus(task)) continue;
      await changeStatus(task, logical, def.id);
    }
    setBulkStatusOpen(false);
    setSelected([]);
  }

  async function applyBulkProject() {
    if (!business?.id || !bulkProjectId) return;
    for (const task of selectedTasks) {
      if (!canManage) continue;
      const result = await saveBusinessTask({
        businessId: business.id,
        id: task.id,
        data: {
          ...taskDraftPayload(draftFromTask(task, today)),
          projectId: bulkProjectId,
          status: isPendingApproval(task.status)
            ? "PENDING_APPROVAL"
            : task.status === "REJECTED"
              ? "REJECTED"
              : isDoneTaskStatus(task.status)
                ? "DONE"
                : displayTaskStatus(task.status),
        },
      });
      if (!result.ok) setToast(taskMutationMessage(result.error, t));
    }
    await reload({ silent: true });
    setBulkProjectOpen(false);
    setSelected([]);
  }

  const statusChips = filterStatusChips(data.taskStatuses);
  const visibleChips = statusChips.slice(0, 5);
  const extraChips = statusChips.slice(5);

  const tabs: Array<{ id: TabId; label: string; hidden?: boolean; badge?: number }> = canManage
    ? [
      { id: "all", label: t("work.allTasksTitle") },
      { id: "mine", label: t("work.myTasks") },
      { id: "approval", label: t("work.kpiPending"), badge: pendingCount },
      { id: "progress", label: t("status.IN_PROGRESS") },
      { id: "overdue", label: t("status.OVERDUE") },
      { id: "done", label: t("work.filterDone") },
    ]
    : [
      { id: "mine", label: t("work.myTasks") },
      { id: "shared", label: t("work.sharedTasks") },
      { id: "approval", label: t("work.kpiPending") },
      { id: "done", label: t("work.filterDone") },
    ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={canManage ? t("work.taskControl") : t("work.myTasks")}
        subtitle={canManage ? t("work.taskControlSubtitle") : t("work.myTasksSubtitle")}
        actions={<PrimaryButton onClick={() => setDraft(emptyTaskDraft(today))}>{t("work.newTaskFull")}</PrimaryButton>}
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm ${tab === item.id ? "bg-[#0F172A] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {item.label}
            {item.badge ? <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-amber-950">{item.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setStatusChip("")}
          className={`inline-flex shrink-0 rounded-full px-3 py-1.5 text-sm ${!statusChip ? "bg-[#2563EB] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
        >
          {t("common.all")}
        </button>
        {visibleChips.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStatusChip(item.id)}
            className={`inline-flex shrink-0 rounded-full px-3 py-1.5 text-sm ${statusChip === item.id ? "bg-[#2563EB] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {statusDefinitionName(item, locale)}
          </button>
        ))}
        {extraChips.length ? (
          <select
            className="rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200"
            value={extraChips.some((item) => item.id === statusChip) ? statusChip : ""}
            onChange={(event) => setStatusChip(event.target.value)}
          >
            <option value="">{t("work.moreActions")} ▾</option>
            {extraChips.map((item) => <option key={item.id} value={item.id}>{statusDefinitionName(item, locale)}</option>)}
          </select>
        ) : null}
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-4 xl:grid-cols-6">
        <input className={inputClass} placeholder={t("common.search")} value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">{t("common.priority")}</option>
          {TASK_PRIORITIES.filter((item) => item !== "MEDIUM").map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
        </select>
        <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          <option value="">{t("common.department")}</option>
          {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {canManage ? (
          <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">{t("common.employee")}</option>
            {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
        ) : null}
        <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">{t("common.project")}</option>
          {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t("common.status")}</option>
          {["PENDING_APPROVAL", "TODO", "IN_PROGRESS", "WAITING", "COMPLETED", "REJECTED", "ARCHIVED"].map((item) => (
            <option key={item} value={item}>{labelOf(item)}</option>
          ))}
        </select>
        {canViewFinance ? (
          <button type="button" className="text-sm text-slate-600 underline" onClick={() => setMoreFilters((open) => !open)}>
            {t("work.moreFilters")}
          </button>
        ) : null}
      </div>

      {canViewFinance && moreFilters ? (
        <div className="grid gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
          <select className={inputClass} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
            <option value="">{t("work.paymentStatus")}</option>
            <option value="UNPAID">{t("status.UNPAID")}</option>
            <option value="PARTIALLY_PAID">{t("status.PARTIALLY_PAID")}</option>
            <option value="PAID">{t("status.PAID")}</option>
          </select>
          <input className={inputClass} inputMode="decimal" placeholder={t("work.priceFrom")} value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
          <input className={inputClass} inputMode="decimal" placeholder={t("work.priceTo")} value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
        </div>
      ) : null}

      {canViewFinance && canManage ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{t("work.dueAmount")}</p>
            <p className="text-lg font-semibold">{formatIls(financeSummary.due)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{t("work.received")}</p>
            <p className="text-lg font-semibold">{formatIls(financeSummary.paid)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{t("work.balance")}</p>
            <p className="text-lg font-semibold">{formatIls(financeSummary.balance)}</p>
          </div>
        </div>
      ) : null}

      {selected.length ? (
        <div className="hidden items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex">
          <div>
            <p className="text-sm font-medium">{t("work.selectedCount", { count: String(selected.length) })}</p>
            {selectedUnpriced.length && canReceivePayment ? (
              <p className="text-xs text-amber-700">{t("work.priceBeforePay")}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? <GhostButton onClick={() => setBulkStatusOpen(true)}>{t("work.changeStatusBulk")}</GhostButton> : null}
            {canManage ? <GhostButton onClick={() => setBulkProjectOpen(true)}>{t("work.bulkAssignProject")}</GhostButton> : null}
            {canSetPrice ? <GhostButton onClick={() => setPriceOpen(true)}>{t("work.setAmount")}</GhostButton> : null}
            {canReceivePayment ? (
              <PrimaryButton disabled={!selectedPayable.length} onClick={() => setPaymentOpen(true)}>{t("work.receivePayment")}</PrimaryButton>
            ) : null}
            <div className="relative">
              <GhostButton onClick={() => setMoreOpen((open) => !open)}>{t("work.moreActions")} ⋯</GhostButton>
              {moreOpen ? (
                <div className="absolute end-0 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  <button type="button" className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-slate-50" onClick={() => { setSelected([]); setMoreOpen(false); }}>{t("work.clearSelection")}</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {rows.length ? (
        <>
          <div className="grid gap-3 md:hidden">
            {rows.map((task) => (
              <TaskWorkCard
                key={task.id}
                task={task}
                employees={data.employees}
                departments={data.departments}
                today={today}
                onOpen={() => { setDetails(task); setOpenChat(false); }}
                statuses={data.taskStatuses}
                selectable={canSelectRows}
                selected={selected.includes(task.id)}
                onToggle={() => setSelected((current) => current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id])}
                canPay={canReceivePayment}
                canSetPrice={canSetPrice}
                showFinance={canViewFinance}
                onPay={() => { setSelected([task.id]); setPaymentOpen(true); }}
                onSetPrice={() => { setSelected([task.id]); setPriceOpen(true); }}
                canManage={canManage}
                canChangeStatus={canChangeStatus(task)}
                statusBusy={busyId === task.id}
                onStatus={(status, statusId) => void changeStatus(task, status, statusId)}
                onDecide={(action) => void decideStatus(task, action)}
                onPriority={(priority) => void changePriority(task, priority)}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-start text-xs text-slate-500">
                <tr>
                  {canSelectRows ? (
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && selected.length === rows.length}
                        onChange={(event) => toggleAll(event.target.checked)}
                        aria-label={t("work.selectAll")}
                      />
                    </th>
                  ) : null}
                  {[t("work.task"), t("common.project"), t("work.participants"), t("common.department"), t("work.time"), t("common.priority"), t("common.status"), ...(canViewFinance ? [t("work.paymentStatus")] : []), t("common.actions")].map((item) => (
                    <th key={item} className="px-3 py-3 font-medium">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => {
                  const left = task.dueDate ? daysBetween(today, task.dueDate) : null;
                  return (
                    <tr key={task.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      {canSelectRows ? (
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selected.includes(task.id)}
                            onChange={() => setSelected((current) => current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id])}
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <button type="button" className="text-start" onClick={() => { setDetails(task); setOpenChat(false); }}>
                          <p className="font-medium">{task.title}</p>
                        </button>
                      </td>
                      <td className="px-3 py-3">{projectName(data.projects, task.projectId)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span>{employeeName(data.employees, task.assigneeId)}</span>
                          <CollaboratorAvatars employees={data.employees} ids={task.collaboratorIds} />
                        </div>
                      </td>
                      <td className="px-3 py-3">{departmentName(data.departments, task.departmentId)}</td>
                      <td className="px-3 py-3">{task.startTime ? `${task.startTime}${task.endTime ? `–${task.endTime}` : ""}` : task.dueDate ?? "—"}{left !== null ? ` · ${t("work.daysShort", { count: String(left) })}` : ""}</td>
                      <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        <TaskPriorityPicker
                          task={task}
                          canEdit={canManage}
                          busy={busyId === task.id}
                          onPriority={(priority) => void changePriority(task, priority)}
                        />
                      </td>
                      <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        <TaskStatusPicker
                          task={task}
                          today={today}
                          statuses={data.taskStatuses}
                          canManage={canManage}
                          canChange={canChangeStatus(task)}
                          busy={busyId === task.id}
                          onStatus={(status, statusId) => void changeStatus(task, status, statusId)}
                          onDecide={(action) => void decideStatus(task, action)}
                        />
                      </td>
                      {canViewFinance ? (
                        <td className="px-3 py-3">
                          <PaymentStatusBadge status={task.paymentStatus} />
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <GhostButton onClick={() => { setDetails(task); setOpenChat(false); }}>{t("work.taskDetails")}</GhostButton>
                          {canReceivePayment && task.priceIncludingVat !== null && (task.balanceDue ?? 0) > 0 ? (
                            <GhostButton onClick={() => { setSelected([task.id]); setPaymentOpen(true); }}>{t("work.receivePayment")}</GhostButton>
                          ) : null}
                          {canManage || task.createdByUserId === user.id ? (
                            <GhostButton onClick={() => setDraft(draftFromTask(task, today))}>{t("common.edit")}</GhostButton>
                          ) : null}
                          {canManage && !isPendingApproval(task.status) ? (
                            <>
                              <GhostButton disabled={busy} onClick={() => void run("start", task)}>{t("tasks.start")}</GhostButton>
                              <GhostButton disabled={busy} onClick={() => void run("finish", task)}>{t("tasks.finish")}</GhostButton>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState icon={ClipboardList} title={t("work.noTasks")} action={<PrimaryButton onClick={() => setDraft(emptyTaskDraft(today))}>{t("work.createTask")}</PrimaryButton>} />
      )}

      {selected.length ? (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-slate-200 bg-white px-4 py-3 shadow-lg md:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{t("work.selectedCount", { count: String(selected.length) })} · {formatIls(selectedDue)}</p>
            <div className="flex gap-2">
              {canManage ? <GhostButton onClick={() => setBulkStatusOpen(true)}>{t("work.changeStatusBulk")}</GhostButton> : null}
              {canSetPrice ? <GhostButton onClick={() => setPriceOpen(true)}>{t("work.setAmount")}</GhostButton> : null}
              {canReceivePayment ? <PrimaryButton disabled={!selectedPayable.length} onClick={() => setPaymentOpen(true)}>{t("work.receivePayment")}</PrimaryButton> : null}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-24 start-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm text-white shadow-lg lg:bottom-8">
          {toast}
        </div>
      ) : null}

      {details && business?.id ? (
        <TaskDetailDrawer
          task={tasks.find((item) => item.id === details.id) ?? details}
          employees={data.employees}
          departments={data.departments}
          projects={data.projects}
          canManage={canManage}
          canViewFinance={canViewFinance}
          canSetPrice={canSetPrice}
          canReceivePayment={canReceivePayment}
          vatRate={data.settings.vatRate}
          canChat
          businessId={business.id}
          currentEmployeeId={membershipEmployeeId}
          openChat={openChat}
          onClose={() => { setDetails(null); setOpenChat(false); }}
          onChanged={() => void reload({ silent: true })}
        />
      ) : null}

      {draft && business?.id ? (
        <TaskFormModal
          draft={draft}
          onChange={setDraft}
          onClose={() => { setDraft(null); setFormError(null); }}
          onSave={() => save()}
          onSaved={() => {
            setDraft(null);
            setToast(canManage ? t("tasks.saved") : t("work.sentForApproval"));
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
          canEditTeam={canManage}
          canCreateProject={permissions.includes("projects.manage") || membership?.role === "BUSINESS_OWNER"}
          canCreateDepartment={permissions.includes("departments.manage") || membership?.role === "BUSINESS_OWNER"}
          canSetPrice={canSetPrice}
          onCatalogRefresh={() => reload({ silent: true })}
          error={formError}
        />
      ) : null}

      {priceOpen && business?.id && selectedTasks.length ? (
        <PriceModal
          tasks={selectedTasks.length ? selectedTasks : []}
          businessId={business.id}
          vatRate={data.settings.vatRate}
          onClose={() => setPriceOpen(false)}
          onSaved={() => {
            setPriceOpen(false);
            setToast(t("work.amountSaved"));
            void reload({ silent: true });
          }}
        />
      ) : null}

      {bulkStatusOpen ? (
        <Modal title={t("work.changeStatusBulk")} onClose={() => setBulkStatusOpen(false)}>
          <div className="grid gap-1">
            {filterStatusChips(data.taskStatuses).filter((item) => item.id !== "PENDING_APPROVAL").map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-xl px-3 py-2 text-start text-sm hover:bg-slate-50"
                onClick={() => void applyBulkStatus(item.id)}
              >
                {statusDefinitionName(item, locale)}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {bulkProjectOpen ? (
        <Modal title={t("work.bulkAssignProject")} onClose={() => setBulkProjectOpen(false)}>
          <Field label={t("common.project")}>
            <select className={inputClass} value={bulkProjectId} onChange={(event) => setBulkProjectId(event.target.value)}>
              <option value="">{t("work.pickProject")}</option>
              {data.projects.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <GhostButton onClick={() => setBulkProjectOpen(false)}>{t("common.cancel")}</GhostButton>
            <PrimaryButton disabled={!bulkProjectId} onClick={() => void applyBulkProject()}>{t("common.save")}</PrimaryButton>
          </div>
        </Modal>
      ) : null}

      {paymentOpen && business?.id ? (
        <PaymentModal
          tasks={selectedTasks}
          businessId={business.id}
          defaultDate={today}
          projects={data.projects}
          onClose={() => setPaymentOpen(false)}
          onSaved={() => {
            setPaymentOpen(false);
            setSelected([]);
            setToast(t("work.paymentRecorded"));
            void reload({ silent: true });
          }}
        />
      ) : null}
    </div>
  );
}
