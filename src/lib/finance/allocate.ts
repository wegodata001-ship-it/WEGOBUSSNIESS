import { money } from "@/lib/finance/money";

export type AllocatableTask = {
  id: string;
  balanceDue: number;
};

export function allocateByTaskOrder(tasks: AllocatableTask[], amount: number) {
  let remaining = money(amount);
  const allocations: Array<{ taskId: string; amount: number }> = [];

  for (const task of tasks) {
    if (remaining <= 0) {
      allocations.push({ taskId: task.id, amount: 0 });
      continue;
    }
    const take = money(Math.min(remaining, Math.max(0, task.balanceDue)));
    allocations.push({ taskId: task.id, amount: take });
    remaining = money(remaining - take);
  }

  return {
    allocations,
    allocated: money(amount - remaining),
    leftover: remaining,
  };
}

export function allocationsTotal(allocations: Array<{ amount: number }>) {
  return money(allocations.reduce((sum, item) => sum + item.amount, 0));
}
