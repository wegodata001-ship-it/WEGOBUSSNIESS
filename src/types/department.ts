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
  createdAt: Date | null;
  updatedAt: Date | null;
};
