import { createHash } from "node:crypto";
import type { BusinessDocumentRecord } from "@/types/business-doc";

export function documentContentHash(doc: Pick<BusinessDocumentRecord, "title" | "intro" | "lines" | "discount" | "discountType" | "vatInclusive" | "vatRate" | "terms" | "clientId" | "projectId">) {
  return createHash("sha256").update(JSON.stringify({
    title: doc.title,
    intro: doc.intro,
    lines: doc.lines,
    discount: doc.discount,
    discountType: doc.discountType,
    vatInclusive: doc.vatInclusive,
    vatRate: doc.vatRate,
    terms: doc.terms,
    clientId: doc.clientId,
    projectId: doc.projectId,
  })).digest("hex");
}
