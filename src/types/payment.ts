export const TASK_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"] as const;
export type TaskPaymentStatus = (typeof TASK_PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "CASH",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "BIT",
  "CHECK",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_RECORD_STATUSES = ["RECORDED", "VOIDED"] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export const PAYMENT_ALLOCATION_TARGETS = ["TASK", "PROJECT_BASE"] as const;
export type PaymentAllocationTarget = (typeof PAYMENT_ALLOCATION_TARGETS)[number];

export type PaymentAllocation = {
  paymentId: string;
  /** TASK = billable task line; PROJECT_BASE = agreed project price. */
  target: PaymentAllocationTarget;
  taskId: string | null;
  projectId: string | null;
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
  /** Optional project scope for project-card payments (may also allocate to tasks). */
  projectId: string | null;
  allocations: PaymentAllocation[];
  createdByUserId: string;
  createdByEmployeeId: string | null;
  createdAt: Date | null;
  cancelledByUserId: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
};
