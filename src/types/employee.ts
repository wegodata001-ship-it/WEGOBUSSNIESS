export const EMPLOYEE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export type Employee = {
  id: string;
  businessId: string;
  userId: string | null;
  uid: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  name: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  jobTitle: string | null;
  role: string | null;
  status: EmployeeStatus;
  active: boolean;
  startDate: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
