import { money } from "@/lib/finance/money";
import type { MoneyMovement } from "@/types/movement";
import type { Task } from "@/types/task";

export function pricedTaskFinance(tasks: Task[]) {
  const priced = tasks.filter((task) => task.priceIncludingVat !== null);
  const total = money(priced.reduce((sum, task) => sum + (task.priceIncludingVat ?? 0), 0));
  const received = money(priced.reduce((sum, task) => sum + task.paidAmount, 0));
  return {
    total,
    received,
    open: money(Math.max(0, total - received)),
  };
}

export function recordedMovements(items: MoneyMovement[]) {
  return items.filter((item) => item.status === "RECORDED");
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function movementsMonthSummary(items: MoneyMovement[], month: string) {
  const rows = recordedMovements(items).filter((item) => monthKey(item.date) === month);
  const income = money(rows.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + item.amount, 0));
  const expense = money(rows.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + item.amount, 0));
  return {
    income,
    expense,
    net: money(income - expense),
  };
}
