"use client";

import { CollaboratorAvatars } from "@/components/admin/employee-multi-select";
import { useI18n } from "@/components/providers/i18n-provider";
import { TaskPriorityPicker, TaskStatusPicker } from "@/components/tasks/task-inline-fields";
import { departmentName, employeeName } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { taskParticipantIds } from "@/lib/admin/task-team";
import { formatIls } from "@/lib/finance/money";
import type { Department, Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import type { Task, TaskPriority, TaskStatus } from "@/types/task";
import type { TaskStatusDefinition } from "@/types/task-status";

export function TaskWorkCard({
  task,
  employees,
  departments,
  today,
  statuses = [],
  onOpen,
  selectable,
  selected,
  onToggle,
  canPay,
  canSetPrice,
  onPay,
  onSetPrice,
  showFinance,
  canManage,
  canChangeStatus,
  statusBusy,
  onStatus,
  onDecide,
  onPriority,
}: {
  task: Task;
  employees: Employee[];
  departments?: Department[];
  projects?: Project[];
  today: string;
  onOpen: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  canPay?: boolean;
  canSetPrice?: boolean;
  onPay?: () => void;
  onSetPrice?: () => void;
  showFinance?: boolean;
  canManage?: boolean;
  canChangeStatus?: boolean;
  statusBusy?: boolean;
  statuses?: TaskStatusDefinition[];
  onStatus?: (status: TaskStatus, statusId: string) => void;
  onDecide?: (action: "approve" | "reject") => void;
  onPriority?: (priority: TaskPriority) => void;
}) {
  const { t } = useI18n();
  const people = taskParticipantIds(task);
  const priced = task.priceIncludingVat !== null;
  const buttonClass = "inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700";

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {selectable ? (
            <input type="checkbox" checked={Boolean(selected)} onChange={onToggle} className="mt-1 h-5 w-5 rounded border-slate-300" />
          ) : null}
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">{task.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              {people.map((id) => employeeName(employees, id)).slice(0, 2).join(", ") || t("common.unassigned")}
              {departments?.length ? ` · ${departmentName(departments, task.departmentId)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {onPriority ? (
            <TaskPriorityPicker task={task} canEdit={Boolean(canManage)} busy={statusBusy} onPriority={onPriority} />
          ) : null}
          {onStatus ? (
            <TaskStatusPicker
              task={task}
              today={today}
              statuses={statuses}
              canManage={Boolean(canManage)}
              canChange={Boolean(canChangeStatus)}
              busy={statusBusy}
              onStatus={onStatus}
              onDecide={onDecide}
            />
          ) : (
            <TaskStatusPicker
              task={task}
              today={today}
              statuses={statuses}
              canManage={false}
              canChange={false}
              onStatus={() => undefined}
            />
          )}
        </div>
      </div>
      {showFinance ? (
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          {priced ? (
            <>
              <p className="flex justify-between font-medium"><span>{t("pay.total")}</span><span>{formatIls(task.priceIncludingVat)}</span></p>
              {task.paymentStatus === "PAID" ? (
                <p className="mt-1 text-emerald-600">● {labelOf("PAID")} {formatIls(task.paidAmount)}</p>
              ) : task.paymentStatus === "PARTIALLY_PAID" ? (
                <div className="mt-1 space-y-0.5 text-amber-700">
                  <p>● {labelOf("PARTIALLY_PAID")}</p>
                  <p>{t("pay.paidAmount", { amount: formatIls(task.paidAmount) })}</p>
                  <p>{t("pay.balanceDue", { amount: formatIls(task.balanceDue) })}</p>
                </div>
              ) : (
                <p className="mt-1 text-rose-600">● {labelOf("UNPAID")}</p>
              )}
            </>
          ) : canSetPrice ? null : (
            <p className="text-slate-400">{t("work.noPrice")}</p>
          )}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        {showFinance && !priced && canSetPrice ? (
          <button type="button" onClick={onSetPrice} className={`${buttonClass} border-[#2563EB] text-[#2563EB]`}>+ {t("work.setAmount")}</button>
        ) : null}
        {canPay && priced && (task.balanceDue ?? 0) > 0 ? (
          <button type="button" onClick={onPay} className={`${buttonClass} bg-[#2563EB] text-white`}>{t("work.receivePayment")}</button>
        ) : null}
        <button type="button" onClick={onOpen} className={buttonClass}>{t("common.details")}</button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <CollaboratorAvatars employees={employees} ids={people} />
      </div>
    </div>
  );
}
