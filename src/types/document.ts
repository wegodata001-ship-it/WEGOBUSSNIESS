export const DOCUMENT_CATEGORIES = [
  "QUOTE",
  "INVOICE",
  "CONTRACT",
  "BRIEF",
  "DESIGN",
  "CLIENT",
  "OTHER",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type BusinessDocument = {
  id: string;
  businessId: string;
  name: string;
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
  url: string | null;
  projectId: string | null;
  clientName: string;
  category: DocumentCategory;
  note: string;
  uploadedByUserId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};
