export const PROJECT_DB_KINDS = ["FIREBASE", "SUPABASE", "OTHER"] as const;
export type ProjectDbKind = (typeof PROJECT_DB_KINDS)[number];

export const PROJECT_HOSTING_KINDS = ["VERCEL", "CLOUDFLARE", "OTHER"] as const;
export type ProjectHostingKind = (typeof PROJECT_HOSTING_KINDS)[number];

export type ProjectSystemDetails = {
  systemName: string;
  systemDescription: string;
  systemUrl: string | null;
  adminUrl: string | null;
  username: string;
  /** Never store plaintext passwords. True only when an external secret ref exists. */
  passwordConfigured: boolean;
  passwordSecretRef: string | null;
  githubUrl: string | null;
  databaseKind: ProjectDbKind | null;
  databaseNotes: string;
  hostingKind: ProjectHostingKind | null;
  hostingNotes: string;
  domain: string;
  domainRenewalDate: string | null;
  ownerEmployeeId: string | null;
  technicalNotes: string;
  updatedAt: Date | null;
  updatedByUserId: string | null;
};

export type ProjectSystemFile = {
  id: string;
  businessId: string;
  projectId: string;
  name: string;
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
  uploadedByUserId: string;
  createdAt: Date | null;
};

export type ProjectMaintenanceLog = {
  id: string;
  businessId: string;
  projectId: string;
  title: string;
  body: string;
  createdByUserId: string;
  createdByEmployeeId: string | null;
  createdAt: Date | null;
};

export function emptyProjectSystemDetails(): ProjectSystemDetails {
  return {
    systemName: "",
    systemDescription: "",
    systemUrl: null,
    adminUrl: null,
    username: "",
    passwordConfigured: false,
    passwordSecretRef: null,
    githubUrl: null,
    databaseKind: null,
    databaseNotes: "",
    hostingKind: null,
    hostingNotes: "",
    domain: "",
    domainRenewalDate: null,
    ownerEmployeeId: null,
    technicalNotes: "",
    updatedAt: null,
    updatedByUserId: null,
  };
}
