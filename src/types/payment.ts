export const TASK_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"] as const;
export type TaskPaymentStatus = (typeof TASK_PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "CASH",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "CHECK",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_RECORD_STATUSES = ["RECORDED", "VOIDED"] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export type PaymentAllocation = {
  paymentId: string;
  taskId: string;
  amount: number;
};

export type PaymentRecord = {
  id: string;
  businessId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference: string;
  notes: string;
  status: PaymentRecordStatus;
  allocations: PaymentAllocation[];
  createdByUserId: string;
  createdByEmployeeId: string | null;
  createdAt: Date | null;
  cancelledByUserId: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
};
