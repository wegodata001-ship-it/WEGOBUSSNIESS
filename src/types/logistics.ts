export const REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "NEED_INFO",
  "FULFILLED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_TYPES = [
  "EXPENSE",
  "PURCHASE",
  "EQUIPMENT",
  "TRAVEL",
  "LOGISTICS",
  "LEAVE",
  "OTHER",
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export type LogisticsRequest = {
  id: string;
  businessId: string;
  title: string;
  details: string;
  type: RequestType;
  status: RequestStatus;
  amount: number | null;
  fileUrl: string | null;
  requestedByEmployeeId: string;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  managerResponse: string;
  handledBy: string | null;
  handledAt: Date | null;
  requestDate: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
