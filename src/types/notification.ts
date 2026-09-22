export type AppNotification = {
  id: string;
  businessId: string;
  userId: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: Date | null;
};

export type ActivityLog = {
  id: string;
  businessId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  message: string;
  createdAt: Date | null;
};

export type BusinessSettings = {
  id: string;
  businessId: string;
  allowEmployeeSelfRequests: boolean;
  workWeekStart: number;
  updatedAt: Date | null;
};
