import type { BusinessService } from "@/types/notification";

export const BUSINESS_DOC_KINDS = ["QUOTE", "CONTRACT", "CUSTOM"] as const;
export type BusinessDocKind = (typeof BUSINESS_DOC_KINDS)[number];

export const BUSINESS_DOC_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "APPROVED",
  "SIGNED",
  "REJECTED",
  "EXPIRED",
] as const;
export type BusinessDocStatus = (typeof BUSINESS_DOC_STATUSES)[number];

export const DOC_PRICE_MODES = ["UNIT", "INCLUDED", "NONE"] as const;
export type DocPriceMode = (typeof DOC_PRICE_MODES)[number];

export type BusinessDocLine = {
  id: string;
  taskId: string | null;
  title: string;
  description: string;
  note: string;
  qty: number;
  unitPrice: number;
  priceMode: DocPriceMode;
  saveToCatalog?: boolean;
};

export type BusinessDocTotals = {
  subtotal: number;
  discount: number;
  beforeVat: number;
  vat: number;
  total: number;
  vatRate: number;
};

export type BusinessDocBranding = {
  primaryColor: string;
  showLogo: boolean;
  logoSize: number;
  footerNote: string;
};

export type BusinessDocumentRecord = {
  id: string;
  businessId: string;
  kind: BusinessDocKind;
  language: "he" | "ar";
  number: string;
  title: string;
  intro: string;
  date: string;
  validDays: number;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientTaxId: string | null;
  clientAddress: string | null;
  projectId: string | null;
  status: BusinessDocStatus;
  lines: BusinessDocLine[];
  discount: number;
  discountType: "AMOUNT" | "PERCENT";
  vatInclusive: boolean;
  vatRate: number;
  totals: BusinessDocTotals;
  terms: string;
  requiresSignature: boolean;
  publicToken: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  signedAt: Date | null;
  signerName: string | null;
  signerIdNumber: string | null;
  signature: string | null;
  documentVersion: number;
  contentHash: string;
  frozen: boolean;
  parentDocumentId: string | null;
  branding: BusinessDocBranding;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type TermsTemplate = {
  id: string;
  businessId: string;
  name: string;
  body: string;
  createdAt: Date | null;
};

export type ServiceItem = {
  id: string;
  businessId: string;
  title: string;
  description: string;
  defaultPrice: number | null;
  createdAt: Date | null;
};

export type BusinessProfile = {
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
};
