export const EMPLOYEE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export type Employee = {
  id: string;
  businessId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  jobTitle: string | null;
  status: EmployeeStatus;
  startDate: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
