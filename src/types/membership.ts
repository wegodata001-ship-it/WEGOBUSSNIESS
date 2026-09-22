import type { Permission } from "@/types/permissions";
import type { BusinessRole } from "@/types/roles";

export type Membership = {
  userId: string;
  businessId: string;
  employeeId: string | null;
  role: BusinessRole;
  permissions: Permission[];
  email: string | null;
  displayName: string | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type UserBusinessLink = {
  businessId: string;
  role: BusinessRole;
  isActive: boolean;
};
