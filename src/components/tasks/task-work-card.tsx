"use client";

import { CollaboratorAvatars } from "@/components/admin/employee-multi-select";
import { StatusBadge } from "@/components/admin/ui";
import { departmentName, employeeName } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { isOverdue } from "@/lib/admin/time";
import { taskParticipantIds } from "@/lib/admin/task-team";
import { formatIls } from "@/lib/finance/money";
import type { Department, Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import type { Task } from "@/types/task";

export function TaskWorkCard({
  task,
  employees,
  departments,
  today,
  onOpen,
  selectable,
  selected,
  onToggle,
  canPay,
  canSetPrice,
  onPay,
  onSetPrice,
  showFinance,
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
}) {
  const people = taskParticipantIds(task);
  const overdue = isOverdue(task, today);
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
              {people.map((id) => employeeName(employees, id)).slice(0, 2).join(", ") || "לא משויך"}
              {departments?.length ? ` · ${departmentName(departments, task.departmentId)}` : ""}
            </p>
          </div>
        </div>
        <StatusBadge value={overdue ? "OVERDUE" : task.status} label={overdue ? "באיחור" : labelOf(task.status)} />
      </div>
      {showFinance ? (
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          {priced ? (
            <>
              <p className="flex justify-between font-medium"><span>סה״כ</span><span>{formatIls(task.priceIncludingVat)}</span></p>
              {task.paymentStatus === "PAID" ? (
                <p className="mt-1 text-emerald-600">● שולם {formatIls(task.paidAmount)}</p>
              ) : task.paymentStatus === "PARTIALLY_PAID" ? (
                <div className="mt-1 space-y-0.5 text-amber-700">
                  <p>● שולם חלקית</p>
                  <p>שולם: {formatIls(task.paidAmount)}</p>
                  <p>יתרה: {formatIls(task.balanceDue)}</p>
                </div>
              ) : (
                <p className="mt-1 text-rose-600">● לא שולם</p>
              )}
            </>
          ) : canSetPrice ? null : (
            <p className="text-slate-400">לא הוגדר מחיר</p>
          )}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        {showFinance && !priced && canSetPrice ? (
          <button type="button" onClick={onSetPrice} className={`${buttonClass} border-[#2563EB] text-[#2563EB]`}>+ הגדרת סכום</button>
        ) : null}
        {canPay && priced && (task.balanceDue ?? 0) > 0 ? (
          <button type="button" onClick={onPay} className={`${buttonClass} bg-[#2563EB] text-white`}>קבלת תשלום</button>
        ) : null}
        <button type="button" onClick={onOpen} className={buttonClass}>פרטים</button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <CollaboratorAvatars employees={employees} ids={people} />
      </div>
    </div>
  );
}
