import type { Task } from "@/types/task";

export function hideTaskFinance(task: Task): Task {
  return {
    ...task,
    billingMode: "INCLUDED",
    priceBeforeVat: null,
    vatRate: null,
    vatAmount: null,
    priceIncludingVat: null,
    priceVatMode: "EXCLUDING_VAT",
    paidAmount: 0,
    balanceDue: null,
    paymentStatus: null,
    paymentIds: [],
    deletedAt: task.deletedAt ?? null,
    deletedByUserId: task.deletedByUserId ?? null,
  };
}
