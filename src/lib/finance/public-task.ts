import type { Task } from "@/types/task";

export function hideTaskFinance(task: Task): Task {
  return {
    ...task,
    priceBeforeVat: null,
    vatRate: null,
    vatAmount: null,
    priceIncludingVat: null,
    paidAmount: 0,
    balanceDue: null,
    paymentStatus: null,
    paymentIds: [],
  };
}
