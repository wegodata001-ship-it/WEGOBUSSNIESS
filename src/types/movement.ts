import type { PaymentMethod } from "@/types/payment";

export const MOVEMENT_TYPES = ["INCOME", "EXPENSE"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_STATUSES = ["RECORDED", "VOIDED"] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

export type MoneyMovement = {
  id: string;
  businessId: string;
  type: MovementType;
  amount: number;
  date: string;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  taskIds: string[];
  paymentId: string | null;
  paymentMethod: PaymentMethod | null;
  description: string;
  note: string;
  status: MovementStatus;
  createdByUserId: string;
  createdByEmployeeId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
