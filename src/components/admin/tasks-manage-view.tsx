"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { CollaboratorAvatars } from "@/components/admin/employee-multi-select";
import { TaskFormModal, draftFromTask, emptyTaskDraft, taskDraftPayload, type TaskDraft } from "@/components/admin/task-form-modal";
import { GhostButton, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { FinanceCell } from "@/components/tasks/finance-cell";
import { PaymentModal } from "@/components/tasks/payment-modal";
import { PriceModal } from "@/components/tasks/price-modal";
import { TaskDetailDrawer } from "@/components/tasks/task-detail-drawer";
import { TaskWorkCard } from "@/components/tasks/task-work-card";
import { formatIls, money } from "@/lib/finance/money";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { mutateBusiness, saveBusinessTask, taskMutationMessage } from "@/lib/admin/api";
import { departmentName, employeeName, projectName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { isEmployeeOnTask, taskParticipantIds } from "@/lib/admin/task-team";
import { daysBetween, isArchivedTaskStatus, isOverdue } from "@/lib/admin/time";
import { todayInTimeZone } from "@/lib/dates/format";
import { startTask, finishTask } from "@/lib/tasks/actions";
import { isPendingApproval, TASK_PRIORITIES, type Task } from "@/types/task";

type TabId = "all" | "mine" | "shared" | "approval" | "progress" | "overdue" | "done";

export function TasksManageView() {
  const { t } = useI18n();
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
  const [selected, setSelected] = useState<string[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const canViewFinance = canManage || permissions.includes("finance.view") || permissions.includes("finance.receivePayment") || permissions.includes("finance.setPrice");
  const canReceivePayment = permissions.includes("finance.receivePayment") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canSetPrice = permissions.includes("finance.setPrice") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const canSelectFinance = canSetPrice || canReceivePayment;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const id = searchParams.get("taskId");
    if (!id || !data.tasks.length) return;
    const found = data.tasks.find((task) => task.id === id);
    if (found) setDetails(found);
  }, [data.tasks, searchParams]);

  const pendingCount = data.tasks.filter((task) => isPendingApproval(task.status)).length;

  const rows = useMemo(() => {
    return data.tasks.filter((task) => {
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
  }, [canManage, data.tasks, departmentId, dueFilter, employeeId, maxPrice, membershipEmployeeId, minPrice, paymentStatus, priority, projectId, query, status, tab, today, user.id]);

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

  if (loading) return <Spinner label="טוען משימות…" />;

  async function save() {
    if (!business?.id || !draft?.title.trim()) return;
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
      return;
    }
    setDraft(null);
    setToast(canManage ? t("tasks.saved") : "המשימה נשלחה לאישור מנהל");
    await reload({ silent: true });
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

  const tabs: Array<{ id: TabId; label: string; hidden?: boolean; badge?: number }> = canManage
    ? [
      { id: "all", label: "כל המשימות" },
      { id: "mine", label: "המשימות שלי" },
      { id: "approval", label: "ממתינות לאישור", badge: pendingCount },
      { id: "progress", label: "בביצוע" },
      { id: "overdue", label: "באיחור" },
      { id: "done", label: "הושלמו" },
    ]
    : [
      { id: "mine", label: "המשימות שלי" },
      { id: "shared", label: "משימות משותפות" },
      { id: "approval", label: "ממתינות לאישור" },
      { id: "done", label: "הושלמו" },
    ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={canManage ? "מרכז בקרת משימות" : "המשימות שלי"}
        subtitle={canManage ? "יצירה, אישור ומעקב אחר משימות העסק" : "משימות שהוקצו לך ומשימות שהגשת לאישור"}
        actions={<PrimaryButton onClick={() => setDraft(emptyTaskDraft(today))}>+ משימה חדשה</PrimaryButton>}
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

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-4 xl:grid-cols-6">
        <input className={inputClass} placeholder="חיפוש" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">עדיפות</option>
          {TASK_PRIORITIES.filter((item) => item !== "MEDIUM").map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
        </select>
        <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          <option value="">מחלקה</option>
          {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {canManage ? (
          <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">עובד</option>
            {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
        ) : null}
        <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">פרויקט</option>
          {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">סטטוס</option>
          {["PENDING_APPROVAL", "TODO", "IN_PROGRESS", "WAITING", "COMPLETED", "REJECTED", "ARCHIVED"].map((item) => (
            <option key={item} value={item}>{labelOf(item)}</option>
          ))}
        </select>
        {canViewFinance ? (
          <button type="button" className="text-sm text-slate-600 underline" onClick={() => setMoreFilters((open) => !open)}>
            מסננים נוספים
          </button>
        ) : null}
      </div>

      {canViewFinance && moreFilters ? (
        <div className="grid gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
          <select className={inputClass} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
            <option value="">מצב תשלום</option>
            <option value="UNPAID">לא שולם</option>
            <option value="PARTIALLY_PAID">שולם חלקית</option>
            <option value="PAID">שולם</option>
          </select>
          <input className={inputClass} inputMode="decimal" placeholder="מחיר מ-" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
          <input className={inputClass} inputMode="decimal" placeholder="מחיר עד" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
        </div>
      ) : null}

      {canViewFinance && canManage ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">לתשלום</p>
            <p className="text-lg font-semibold">{formatIls(financeSummary.due)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">התקבל</p>
            <p className="text-lg font-semibold">{formatIls(financeSummary.paid)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">יתרה</p>
            <p className="text-lg font-semibold">{formatIls(financeSummary.balance)}</p>
          </div>
        </div>
      ) : null}

      {selected.length ? (
        <div className="hidden items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex">
          <div>
            <p className="text-sm font-medium">{selected.length} משימות נבחרו</p>
            {selectedUnpriced.length && canReceivePayment ? (
              <p className="text-xs text-amber-700">יש להגדיר מחיר למשימות לפני קבלת תשלום</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canSetPrice ? <GhostButton onClick={() => setPriceOpen(true)}>הגדרת סכום</GhostButton> : null}
            {canReceivePayment ? (
              <PrimaryButton disabled={!selectedPayable.length} onClick={() => setPaymentOpen(true)}>קבלת תשלום</PrimaryButton>
            ) : null}
            <GhostButton onClick={() => setSelected([])}>ביטול בחירה</GhostButton>
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
                selectable={canSelectFinance}
                selected={selected.includes(task.id)}
                onToggle={() => setSelected((current) => current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id])}
                canPay={canReceivePayment}
                canSetPrice={canSetPrice}
                showFinance={canViewFinance}
                onPay={() => { setSelected([task.id]); setPaymentOpen(true); }}
                onSetPrice={() => { setSelected([task.id]); setPriceOpen(true); }}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-start text-xs text-slate-500">
                <tr>
                  {canSelectFinance ? (
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && selected.length === rows.length}
                        onChange={(event) => toggleAll(event.target.checked)}
                        aria-label="בחירת הכל"
                      />
                    </th>
                  ) : null}
                  {["משימה", "משתתפים", "מחלקה", "זמן", "עדיפות", "סטטוס", ...(canViewFinance ? ["כספים"] : []), "פעולות"].map((item) => (
                    <th key={item} className="px-3 py-3 font-medium">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => {
                  const left = task.dueDate ? daysBetween(today, task.dueDate) : null;
                  return (
                    <tr key={task.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      {canSelectFinance ? (
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
                          <p className="text-xs text-slate-500">{projectName(data.projects, task.projectId)}</p>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span>{employeeName(data.employees, task.assigneeId)}</span>
                          <CollaboratorAvatars employees={data.employees} ids={task.collaboratorIds} />
                        </div>
                      </td>
                      <td className="px-3 py-3">{departmentName(data.departments, task.departmentId)}</td>
                      <td className="px-3 py-3">{task.startTime ? `${task.startTime}${task.endTime ? `–${task.endTime}` : ""}` : task.dueDate ?? "—"}{left !== null ? ` · ${left}י` : ""}</td>
                      <td className="px-3 py-3"><StatusBadge value={task.priority} label={labelOf(task.priority)} /></td>
                      <td className="px-3 py-3">
                        <StatusBadge value={isOverdue(task, today) ? "OVERDUE" : task.status} label={labelOf(isOverdue(task, today) ? "OVERDUE" : task.status)} />
                      </td>
                      {canViewFinance ? (
                        <td className="px-3 py-3">
                          <FinanceCell
                            task={task}
                            canSetPrice={canSetPrice}
                            canPay={canReceivePayment}
                            onSetPrice={() => { setSelected([task.id]); setPriceOpen(true); }}
                            onPay={() => { setSelected([task.id]); setPaymentOpen(true); }}
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <GhostButton onClick={() => { setDetails(task); setOpenChat(false); }}>פרטים</GhostButton>
                          {canReceivePayment && task.priceIncludingVat !== null && (task.balanceDue ?? 0) > 0 ? (
                            <GhostButton onClick={() => { setSelected([task.id]); setPaymentOpen(true); }}>קבלת תשלום</GhostButton>
                          ) : null}
                          {canManage || task.createdByUserId === user.id ? (
                            <GhostButton onClick={() => setDraft(draftFromTask(task, today))}>עריכה</GhostButton>
                          ) : null}
                          {canManage && !isPendingApproval(task.status) ? (
                            <>
                              <GhostButton disabled={busy} onClick={() => void run("start", task)}>התחלה</GhostButton>
                              <GhostButton disabled={busy} onClick={() => void run("finish", task)}>סיום</GhostButton>
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
        <EmptyState icon={ClipboardList} title="אין משימות להצגה" action={<PrimaryButton onClick={() => setDraft(emptyTaskDraft(today))}>+ יצירת משימה</PrimaryButton>} />
      )}

      {selected.length ? (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-slate-200 bg-white px-4 py-3 shadow-lg md:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{selected.length} משימות · {formatIls(selectedDue)}</p>
            <div className="flex gap-2">
              {canSetPrice ? <GhostButton onClick={() => setPriceOpen(true)}>הגדרת סכום</GhostButton> : null}
              {canReceivePayment ? <PrimaryButton disabled={!selectedPayable.length} onClick={() => setPaymentOpen(true)}>קבלת תשלום</PrimaryButton> : null}
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
          task={data.tasks.find((item) => item.id === details.id) ?? details}
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
          onSave={() => void save()}
          busy={busy}
          businessId={business.id}
          employees={data.employees}
          departments={data.departments}
          projects={data.projects}
          canEditTeam={canManage}
          canCreateProject={permissions.includes("projects.manage") || membership?.role === "BUSINESS_OWNER"}
          canCreateDepartment={permissions.includes("departments.manage") || membership?.role === "BUSINESS_OWNER"}
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
            setToast("הסכום נשמר");
            void reload({ silent: true });
          }}
        />
      ) : null}

      {paymentOpen && business?.id ? (
        <PaymentModal
          tasks={selectedTasks}
          businessId={business.id}
          defaultDate={today}
          onClose={() => setPaymentOpen(false)}
          onSaved={() => {
            setPaymentOpen(false);
            setSelected([]);
            setToast("התשלום נרשם");
            void reload({ silent: true });
          }}
        />
      ) : null}
    </div>
  );
}
