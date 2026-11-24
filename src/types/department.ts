import type { TaskPaymentStatus } from "@/types/payment";
import type { ProjectSystemDetails } from "@/types/project-system";

export const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type Department = {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  managerEmployeeId: string | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type DepartmentCategory = {
  id: string;
  businessId: string;
  departmentId: string;
  name: string;
  isActive: boolean;
  color: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type Project = {
  id: string;
  businessId: string;
  seedKey: string | null;
  legacyId: string | null;
  name: string;
  clientName: string;
  description: string;
  status: ProjectStatus;
  categoryId: string | null;
  categoryName: string | null;
  category: string | null;
  location: string | null;
  projectNumber: string | null;
  departmentId: string | null;
  managerEmployeeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  progress: number;
  isActive: boolean;
  color: string;
  systemDetails: ProjectSystemDetails;
  /** Optional agreed project base price (before VAT). Null/0 = no fixed project price. */
  basePriceBeforeVat: number | null;
  baseVatRate: number | null;
  baseVatAmount: number | null;
  basePriceIncludingVat: number | null;
  basePaidAmount: number;
  baseBalanceDue: number | null;
  basePaymentStatus: TaskPaymentStatus | null;
  paymentIds: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
};
