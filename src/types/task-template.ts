export type TaskTemplate = {
  id: string;
  businessId: string;
  title: string;
  description: string;
  taskType: string;
  departmentId: string | null;
  titleKey: string;
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};
