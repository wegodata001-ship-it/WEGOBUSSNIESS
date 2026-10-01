import type { BusinessDocumentRecord } from "@/types/business-doc";
import type { Business } from "@/types/business";
import type { BusinessService, BusinessSettings } from "@/types/notification";

export type DocumentLanguage = "he" | "ar";

const COPY: Record<DocumentLanguage, Record<string, string>> = {
  he: {
    quote: "הצעת מחיר",
    contract: "חוזה",
    custom: "מסמך",
    number: "מס׳",
    valid: "תוקף",
    days: "ימים",
    taxId: "ח.פ / ע.מ",
    toClient: "ללקוח",
    about: "אודות העסק",
    services: "השירותים שלנו",
    lines: "משימות ושירותים",
    description: "תיאור",
    qty: "כמות",
    amount: "סכום",
    note: "הערה",
    included: "כלול",
    noPrice: "ללא מחיר",
    beforeVat: "לפני מע״מ",
    discount: "הנחה",
    vat: "מע״מ",
    total: "סה״כ לתשלום",
    vatIncluded: "מחיר כולל מע״מ",
    vatAdded: "מע״מ מתווסף",
    terms: "תנאים",
    signature: "חתימת לקוח",
  },
  ar: {
    quote: "عرض سعر",
    contract: "عقد",
    custom: "مستند",
    number: "رقم",
    valid: "الصلاحية",
    days: "أيام",
    taxId: "الرقم الضريبي",
    toClient: "إلى العميل",
    about: "عن العمل",
    services: "خدماتنا",
    lines: "المهام والخدمات",
    description: "الوصف",
    qty: "الكمية",
    amount: "المبلغ",
    note: "ملاحظة",
    included: "مشمول",
    noPrice: "بدون سعر",
    beforeVat: "قبل الضريبة",
    discount: "خصم",
    vat: "ضريبة القيمة المضافة",
    total: "الإجمالي للدفع",
    vatIncluded: "السعر يشمل الضريبة",
    vatAdded: "تُضاف الضريبة",
    terms: "الشروط",
    signature: "توقيع العميل",
  },
};

export function documentLanguageOf(doc: Pick<BusinessDocumentRecord, "language"> | { language?: string } | null | undefined): DocumentLanguage {
  return doc?.language === "ar" ? "ar" : "he";
}

export function documentCopy(lang: DocumentLanguage, key: string) {
  return COPY[lang][key] ?? COPY.he[key] ?? key;
}

export function businessNameForDocument(
  lang: DocumentLanguage,
  business: Pick<Business, "name" | "nameAr"> | null,
  settings: Pick<BusinessSettings, "nameAr">,
) {
  if (lang === "ar") return settings.nameAr || business?.nameAr || business?.name || "";
  return business?.name || "";
}

export function businessAboutForDocument(
  lang: DocumentLanguage,
  settings: Pick<BusinessSettings, "about" | "aboutAr">,
) {
  if (lang === "ar") return settings.aboutAr || settings.about || "";
  return settings.about || "";
}

export function serviceLabelForDocument(lang: DocumentLanguage, service: BusinessService) {
  if (lang === "ar") {
    return {
      name: service.nameAr || service.name,
      description: service.descriptionAr || service.description,
    };
  }
  return { name: service.name, description: service.description };
}

export function kindLabelForDocument(lang: DocumentLanguage, kind: string) {
  if (kind === "CONTRACT") return documentCopy(lang, "contract");
  if (kind === "CUSTOM") return documentCopy(lang, "custom");
  return documentCopy(lang, "quote");
}
