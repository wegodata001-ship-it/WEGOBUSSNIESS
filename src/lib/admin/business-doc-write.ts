import { randomBytes } from "node:crypto";
import { documentContentHash } from "@/lib/docs/hash";
import { calculateDocumentTotals, emptyLine } from "@/lib/docs/totals";
import { getAdminDb } from "@/lib/firebase/admin";
import { toBusinessClient, toBusinessDocumentRecord, toBusinessSettings } from "@/lib/firebase/converters";
import {
  businessDocumentDocPath,
  businessDocsPath,
  businessSettingsDocPath,
  clientDocPath,
  clientsPath,
  serviceItemsPath,
} from "@/lib/firebase/paths";
import { DEFAULT_BUSINESS_VAT_RATE, normalizeVatRate } from "@/lib/finance/vat";
import { todayInTimeZone } from "@/lib/dates/format";
import type { BusinessDocKind, BusinessDocLine, BusinessDocumentRecord } from "@/types/business-doc";
import { BUSINESS_DOC_KINDS } from "@/types/business-doc";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asKind(value: unknown): BusinessDocKind {
  return BUSINESS_DOC_KINDS.includes(value as BusinessDocKind) ? value as BusinessDocKind : "QUOTE";
}

function parseLines(value: unknown): BusinessDocLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").map((item, index) => ({
    id: typeof item.id === "string" ? item.id : `ln-${index}`,
    taskId: typeof item.taskId === "string" ? item.taskId : null,
    title: text(item.title),
    description: text(item.description),
    note: text(item.note),
    qty: typeof item.qty === "number" && Number.isFinite(item.qty) ? item.qty : 1,
    unitPrice: typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
    priceMode: item.priceMode === "INCLUDED" || item.priceMode === "NONE" ? item.priceMode : "UNIT",
  }));
}

function prefix(kind: BusinessDocKind) {
  if (kind === "CONTRACT") return "CT";
  if (kind === "CUSTOM") return "DC";
  return "QT";
}

async function nextNumber(businessId: string, kind: BusinessDocKind) {
  const snap = await getAdminDb().collection(businessDocsPath(businessId)).where("kind", "==", kind).get();
  return `${prefix(kind)}-${new Date().getFullYear()}-${String(snap.size + 1).padStart(4, "0")}`;
}

async function vatRateOf(businessId: string) {
  const snap = await getAdminDb().doc(businessSettingsDocPath(businessId)).get();
  return normalizeVatRate(snap.data()?.vatRate, DEFAULT_BUSINESS_VAT_RATE);
}

function payloadFrom(data: Record<string, unknown>, current: Partial<BusinessDocumentRecord>, vatRate: number) {
  const lines = data.lines !== undefined ? parseLines(data.lines) : current.lines ?? [];
  const discount = typeof data.discount === "number" ? data.discount : current.discount ?? 0;
  const discountType = data.discountType === "PERCENT" || current.discountType === "PERCENT" ? "PERCENT" as const : "AMOUNT" as const;
  const vatInclusive = data.vatInclusive === true || (data.vatInclusive !== false && current.vatInclusive === true);
  const rate = typeof data.vatRate === "number" ? normalizeVatRate(data.vatRate, vatRate) : current.vatRate ?? vatRate;
  const totals = calculateDocumentTotals({ lines, discount, discountType, vatRate: rate, vatInclusive });
  const next = {
    title: text(data.title) || current.title || "",
    language: data.language === "ar" || current.language === "ar" ? "ar" as const : "he" as const,
    intro: data.intro !== undefined ? text(data.intro) : current.intro || "",
    date: text(data.date) || current.date || todayInTimeZone(),
    validDays: typeof data.validDays === "number" ? data.validDays : current.validDays ?? 14,
    clientId: data.clientId !== undefined ? (text(data.clientId) || null) : current.clientId ?? null,
    clientName: data.clientName !== undefined ? text(data.clientName) : current.clientName || "",
    clientPhone: data.clientPhone !== undefined ? (text(data.clientPhone) || null) : current.clientPhone ?? null,
    clientEmail: data.clientEmail !== undefined ? (text(data.clientEmail) || null) : current.clientEmail ?? null,
    clientTaxId: data.clientTaxId !== undefined ? (text(data.clientTaxId) || null) : current.clientTaxId ?? null,
    clientAddress: data.clientAddress !== undefined ? (text(data.clientAddress) || null) : current.clientAddress ?? null,
    projectId: data.projectId !== undefined ? (text(data.projectId) || null) : current.projectId ?? null,
    lines,
    discount,
    discountType,
    vatInclusive,
    vatRate: rate,
    totals,
    terms: data.terms !== undefined ? text(data.terms) : current.terms || "",
    requiresSignature: data.requiresSignature !== undefined ? data.requiresSignature === true : current.requiresSignature === true,
    branding: {
      primaryColor: text((data.branding as { primaryColor?: string } | undefined)?.primaryColor) || current.branding?.primaryColor || "#2563eb",
      showLogo: (data.branding as { showLogo?: boolean } | undefined)?.showLogo !== false && current.branding?.showLogo !== false,
      logoSize: typeof (data.branding as { logoSize?: number } | undefined)?.logoSize === "number"
        ? (data.branding as { logoSize: number }).logoSize
        : current.branding?.logoSize ?? 56,
      footerNote: text((data.branding as { footerNote?: string } | undefined)?.footerNote) || current.branding?.footerNote || "",
    },
  };
  return { ...next, contentHash: documentContentHash(next) };
}

export async function createBusinessDocRecord(input: {
  businessId: string;
  actorUid: string;
  data: Record<string, unknown>;
}) {
  const kind = asKind(input.data.kind);
  const vatRate = await vatRateOf(input.businessId);
  const settings = toBusinessSettings("general", (await getAdminDb().doc(businessSettingsDocPath(input.businessId)).get()).data() ?? {});
  const payload = payloadFrom(input.data, {
    vatRate,
    branding: { primaryColor: "#2563eb", showLogo: true, logoSize: 56, footerNote: settings.about },
    lines: [emptyLine()],
  }, vatRate);
  if (!payload.title) return { ok: false as const, error: "TITLE_REQUIRED", status: 400 };
  const ref = getAdminDb().collection(businessDocsPath(input.businessId)).doc();
  const now = new Date();
  await ref.set({
    businessId: input.businessId,
    kind,
    number: await nextNumber(input.businessId, kind),
    ...payload,
    status: "DRAFT",
    publicToken: null,
    sentAt: null,
    viewedAt: null,
    signedAt: null,
    signerName: null,
    signerIdNumber: null,
    signature: null,
    documentVersion: 1,
    frozen: false,
    parentDocumentId: null,
    createdByUserId: input.actorUid,
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true as const, id: ref.id };
}

export async function updateBusinessDocRecord(input: {
  businessId: string;
  id: string;
  data: Record<string, unknown>;
}) {
  const db = getAdminDb();
  const ref = db.doc(businessDocumentDocPath(input.businessId, input.id));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND", status: 404 };
  const current = toBusinessDocumentRecord(snap.id, snap.data()!);
  const vatRate = current.vatRate || await vatRateOf(input.businessId);
  const payload = payloadFrom(input.data, current, vatRate);
  if (current.frozen || current.status === "SIGNED") {
    if (payload.contentHash !== current.contentHash) {
      const copy = await createBusinessDocRecord({
        businessId: input.businessId,
        actorUid: "system",
        data: {
          ...payload,
          kind: current.kind,
          parentDocumentId: current.id,
        },
      });
      return copy.ok
        ? { ok: true as const, id: copy.id, newVersion: true }
        : copy;
    }
    return { ok: true as const, id: current.id };
  }
  if (Array.isArray(input.data.lines)) {
    await Promise.all(input.data.lines
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && item.saveToCatalog === true && Boolean(text(item.title)))
      .map((item) => db.collection(serviceItemsPath(input.businessId)).add({
        businessId: input.businessId,
        title: text(item.title),
        description: text(item.description),
        defaultPrice: typeof item.unitPrice === "number" ? item.unitPrice : null,
        createdAt: new Date(),
      })));
  }
  await ref.set({ ...payload, updatedAt: new Date() }, { merge: true });
  return { ok: true as const, id: current.id };
}

export async function sendBusinessDocRecord(input: { businessId: string; id: string }) {
  const ref = getAdminDb().doc(businessDocumentDocPath(input.businessId, input.id));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND", status: 404 };
  const current = toBusinessDocumentRecord(snap.id, snap.data()!);
  if (current.status === "SIGNED") return { ok: false as const, error: "SIGNED_LOCKED", status: 409 };
  const token = current.publicToken || `${input.businessId}_${randomBytes(16).toString("base64url")}`;
  await ref.set({
    status: current.status === "DRAFT" || current.status === "REJECTED" ? "SENT" : current.status,
    publicToken: token,
    sentAt: current.sentAt ?? new Date(),
    frozen: false,
    updatedAt: new Date(),
  }, { merge: true });
  return { ok: true as const, id: current.id, token };
}

export async function duplicateBusinessDocRecord(input: { businessId: string; id: string; actorUid: string }) {
  const snap = await getAdminDb().doc(businessDocumentDocPath(input.businessId, input.id)).get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND", status: 404 };
  const current = toBusinessDocumentRecord(snap.id, snap.data()!);
  return createBusinessDocRecord({
    businessId: input.businessId,
    actorUid: input.actorUid,
    data: {
      kind: current.kind,
      title: `${current.title} (עותק)`,
      intro: current.intro,
      validDays: current.validDays,
      clientId: current.clientId,
      clientName: current.clientName,
      clientPhone: current.clientPhone,
      clientEmail: current.clientEmail,
      clientTaxId: current.clientTaxId,
      clientAddress: current.clientAddress,
      projectId: current.projectId,
      lines: current.lines,
      discount: current.discount,
      discountType: current.discountType,
      vatInclusive: current.vatInclusive,
      terms: current.terms,
      requiresSignature: current.requiresSignature,
      branding: current.branding,
    },
  });
}

export async function upsertClientRecord(input: {
  businessId: string;
  id?: string;
  data: Record<string, unknown>;
}) {
  const name = text(input.data.name);
  if (!name) return { ok: false as const, error: "NAME_REQUIRED", status: 400 };
  const db = getAdminDb();
  const ref = input.id
    ? db.doc(clientDocPath(input.businessId, input.id))
    : db.collection(clientsPath(input.businessId)).doc();
  const now = new Date();
  await ref.set({
    businessId: input.businessId,
    name,
    phone: text(input.data.phone) || null,
    email: text(input.data.email) || null,
    taxId: text(input.data.taxId) || null,
    address: text(input.data.address) || null,
    updatedAt: now,
    ...(input.id ? {} : { createdAt: now }),
  }, { merge: true });
  const snap = await ref.get();
  return { ok: true as const, id: ref.id, client: toBusinessClient(ref.id, snap.data() ?? {}) };
}

export async function findBusinessDocByToken(token: string) {
  const businessId = token.split("_")[0] ?? "";
  if (!businessId) return null;
  const snap = await getAdminDb().collection(businessDocsPath(businessId)).where("publicToken", "==", token).limit(1).get();
  const docSnap = snap.docs[0];
  if (!docSnap) return null;
  return toBusinessDocumentRecord(docSnap.id, docSnap.data());
}
