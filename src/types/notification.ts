export type AppNotification = {
  id: string;
  businessId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
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

export const BUSINESS_LEGAL_TYPES = [
  "עוסק פטור",
  "עוסק מורשה",
  "חברה בע״מ",
  "שותפות",
  "עמותה",
  "אחר",
] as const;

export type BusinessLegalType = (typeof BUSINESS_LEGAL_TYPES)[number];

export type BusinessService = {
  id: string;
  name: string;
  description: string;
  order: number;
  active: boolean;
};

export type BusinessSettings = {
  id: string;
  businessId: string;
  allowEmployeeSelfRequests: boolean;
  workWeekStart: number;
  vatRate: number;
  legalType: string;
  customBusinessType: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  about: string;
  services: BusinessService[];
  logoUrl: string | null;
  logoStoragePath: string | null;
  updatedAt: Date | null;
};
