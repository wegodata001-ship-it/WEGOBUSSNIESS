"use client";

import { InlineChoiceBadge } from "@/components/tasks/inline-choice-badge";
import { useI18n } from "@/components/providers/i18n-provider";
import { labelOf } from "@/lib/admin/labels";
import { taskStatusLabel } from "@/lib/admin/task-status-label";
import { workStatusOptions } from "@/lib/admin/task-status-resolve";
import { isOverdue } from "@/lib/admin/time";
import { isDoneTaskStatus, isPendingApproval, TASK_PRIORITIES, type Task, type TaskPriority, type TaskStatus } from "@/types/task";
import { logicalStatusFromType, type TaskStatusDefinition } from "@/types/task-status";

export function TaskStatusPicker({
  task,
  today,
  statuses,
  canManage,
  canChange,
  busy,
  onStatus,
  onDecide,
}: {
  task: Task;
  today: string;
  statuses: TaskStatusDefinition[];
  canManage: boolean;
  canChange: boolean;
  busy?: boolean;
  onStatus: (status: TaskStatus, statusId: string) => void;
  onDecide?: (action: "approve" | "reject") => void;
}) {
  const { t, locale } = useI18n();
  const overdue = isOverdue(task, today);
  const pending = isPendingApproval(task.status);
  const displayLabel = isDoneTaskStatus(task.status)
    ? `✓ ${taskStatusLabel(task, statuses, locale)}`
    : overdue
      ? labelOf("OVERDUE")
      : taskStatusLabel(task, statuses, locale);
  const displayValue = overdue ? "OVERDUE" : task.status;

  if (pending) {
    if (!canManage || !onDecide) {
      return <InlineChoiceBadge value={task.status} label={labelOf(task.status)} options={[]} disabled onSelect={() => undefined} />;
    }
    return (
      <InlineChoiceBadge
        value={task.status}
        label={labelOf(task.status)}
        title={t("work.changeStatus")}
        options={[
          { id: "APPROVE", label: t("work.approve") },
          { id: "REJECT", label: t("work.reject") },
        ]}
        busy={busy}
        onSelect={(id) => onDecide(id === "REJECT" ? "reject" : "approve")}
      />
    );
  }

  if (!canChange) {
    return <InlineChoiceBadge value={displayValue} label={displayLabel} options={[]} disabled onSelect={() => undefined} />;
  }

  const options = workStatusOptions(statuses, canManage);
  return (
    <InlineChoiceBadge
      value={task.statusId || task.status}
      toneValue={displayValue}
      label={displayLabel}
      title={t("work.changeStatus")}
      hint={overdue ? `${t("work.statusNow", { status: taskStatusLabel(task, statuses, locale) })} · ${t("work.overdueFlag")}` : undefined}
      options={options.map((item) => ({ id: item.id, label: locale === "ar" && item.nameAr ? item.nameAr : item.name }))}
      busy={busy}
      onSelect={(id) => {
        const def = options.find((item) => item.id === id);
        if (!def) return;
        onStatus(logicalStatusFromType(def.type, def.id), def.id);
      }}
    />
  );
}

export function TaskPriorityPicker({
  task,
  canEdit,
  busy,
  onPriority,
}: {
  task: Task;
  canEdit: boolean;
  busy?: boolean;
  onPriority: (priority: TaskPriority) => void;
}) {
  const { t } = useI18n();
  const value = task.priority === "MEDIUM" ? "NORMAL" : task.priority;
  return (
    <InlineChoiceBadge
      value={value}
      label={labelOf(value)}
      title={t("work.changePriority")}
      options={TASK_PRIORITIES.filter((item) => item !== "MEDIUM").map((id) => ({ id, label: labelOf(id) }))}
      disabled={!canEdit}
      busy={busy}
      onSelect={(id) => onPriority(id as TaskPriority)}
    />
  );
}
