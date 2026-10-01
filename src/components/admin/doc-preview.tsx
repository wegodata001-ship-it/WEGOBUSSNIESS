import { formatIls } from "@/lib/finance/money";
import { displayBusinessType } from "@/lib/data/business-profile";
import { lineAmount } from "@/lib/docs/totals";
import {
  businessAboutForDocument,
  businessNameForDocument,
  documentCopy,
  documentLanguageOf,
  kindLabelForDocument,
  serviceLabelForDocument,
} from "@/lib/docs/document-copy";
import type { BusinessDocumentRecord } from "@/types/business-doc";
import type { Business } from "@/types/business";
import type { BusinessSettings } from "@/types/notification";

export function DocPreview({
  doc,
  business,
  settings,
}: {
  doc: BusinessDocumentRecord;
  business: Pick<Business, "name" | "nameAr" | "primaryColor" | "logoUrl"> | null;
  settings: BusinessSettings;
}) {
  const lang = documentLanguageOf(doc);
  const color = doc.branding.primaryColor || business?.primaryColor || "#2563eb";
  const logo = settings.logoUrl || business?.logoUrl;
  const kindLabel = kindLabelForDocument(lang, doc.kind);
  const typeLabel = displayBusinessType(settings.legalType, settings.customBusinessType);
  const activeServices = settings.services.filter((item) => item.active);
  const businessName = businessNameForDocument(lang, business, settings);
  const about = businessAboutForDocument(lang, settings);

  return (
    <article dir="rtl" lang={lang} className="mx-auto max-w-[800px] bg-white p-6 text-slate-900 shadow-sm print:shadow-none md:p-10" style={{ fontFamily: lang === "ar" ? "Noto Sans Arabic, Arial, sans-serif" : "Assistant, David, Arial, sans-serif" }}>
      <header className="flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: color }}>
        <div>
          <p className="text-xs font-semibold tracking-wide" style={{ color }}>{kindLabel}</p>
          <h1 className="mt-1 text-2xl font-bold">{doc.title || kindLabel}</h1>
          <p className="mt-1 text-sm text-slate-500">{documentCopy(lang, "number")} {doc.number} · {doc.date}</p>
          {doc.validDays ? <p className="text-xs text-slate-500">{documentCopy(lang, "valid")}: {doc.validDays} {documentCopy(lang, "days")}</p> : null}
        </div>
        <div className="text-end">
          {doc.branding.showLogo && logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={businessName} style={{ height: doc.branding.logoSize || 56 }} className="ms-auto object-contain" />
          ) : null}
          <p className="mt-2 font-semibold">{businessName}</p>
          {typeLabel ? <p className="text-xs text-slate-500">{typeLabel}</p> : null}
          {settings.taxId ? <p className="text-xs text-slate-500">{documentCopy(lang, "taxId")} {settings.taxId}</p> : null}
          {settings.phone ? <p className="text-xs text-slate-500">{settings.phone}</p> : null}
          {settings.email ? <p className="text-xs text-slate-500">{settings.email}</p> : null}
          {settings.address ? <p className="text-xs text-slate-500">{settings.address}</p> : null}
        </div>
      </header>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-slate-500">{documentCopy(lang, "toClient")}</p>
          <p className="font-medium">{doc.clientName || "—"}</p>
          {doc.clientTaxId ? <p className="text-xs text-slate-500">{documentCopy(lang, "taxId")} {doc.clientTaxId}</p> : null}
          {doc.clientPhone ? <p className="text-xs text-slate-500">{doc.clientPhone}</p> : null}
          {doc.clientEmail ? <p className="text-xs text-slate-500">{doc.clientEmail}</p> : null}
          {doc.clientAddress ? <p className="text-xs text-slate-500">{doc.clientAddress}</p> : null}
        </div>
        {about || activeServices.length ? (
          <div>
            {about ? (
              <>
                <p className="text-xs font-semibold text-slate-500">{documentCopy(lang, "about")}</p>
                <p className="whitespace-pre-wrap text-sm text-slate-600">{about}</p>
              </>
            ) : null}
            {activeServices.length ? (
              <div className={about ? "mt-3" : ""}>
                <p className="text-xs font-semibold text-slate-500">{documentCopy(lang, "services")}</p>
                <ul className="mt-1 space-y-1">
                  {activeServices.map((item) => {
                    const service = serviceLabelForDocument(lang, item);
                    return (
                      <li key={item.id}>
                        <p className="text-sm font-medium">{service.name}</p>
                        {service.description ? <p className="text-xs text-slate-500">{service.description}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {doc.intro ? <p className="mt-5 whitespace-pre-wrap text-sm leading-6">{doc.intro}</p> : null}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">{documentCopy(lang, "lines")}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-slate-500">
              <th className="py-2 text-start">{documentCopy(lang, "description")}</th>
              <th className="py-2 text-start">{documentCopy(lang, "qty")}</th>
              <th className="py-2 text-end">{documentCopy(lang, "amount")}</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line) => (
              <tr key={line.id} className="border-b border-slate-100 align-top">
                <td className="py-2">
                  <p className="font-medium">{line.title || "—"}</p>
                  {line.description ? <p className="text-xs text-slate-500">{line.description}</p> : null}
                  {line.note ? <p className="text-xs text-slate-400">{documentCopy(lang, "note")}: {line.note}</p> : null}
                </td>
                <td className="py-2">{line.qty}</td>
                <td className="py-2 text-end">
                  {line.priceMode === "INCLUDED" ? documentCopy(lang, "included") : line.priceMode === "NONE" ? documentCopy(lang, "noPrice") : formatIls(lineAmount(line), "0 ₪")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5 ms-auto max-w-xs text-sm">
        <div className="flex justify-between py-1"><span>{documentCopy(lang, "beforeVat")}</span><span>{formatIls(doc.totals.beforeVat, "0 ₪")}</span></div>
        {doc.totals.discount ? <div className="flex justify-between py-1"><span>{documentCopy(lang, "discount")}</span><span>{formatIls(doc.totals.discount, "0 ₪")}</span></div> : null}
        <div className="flex justify-between py-1"><span>{documentCopy(lang, "vat")} {Math.round(doc.totals.vatRate * 100)}%</span><span>{formatIls(doc.totals.vat, "0 ₪")}</span></div>
        <div className="mt-1 flex justify-between border-t pt-2 font-semibold" style={{ color }}>
          <span>{documentCopy(lang, "total")}</span><span>{formatIls(doc.totals.total, "0 ₪")}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{doc.vatInclusive ? documentCopy(lang, "vatIncluded") : documentCopy(lang, "vatAdded")}</p>
      </section>

      {doc.terms ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">{documentCopy(lang, "terms")}</h2>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{doc.terms}</p>
        </section>
      ) : null}

      {doc.signature ? (
        <section className="mt-8 border-t pt-4">
          <p className="text-xs font-semibold text-slate-500">{documentCopy(lang, "signature")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={doc.signature} alt="" className="mt-2 h-16 object-contain" />
          <p className="mt-2 text-sm">{doc.signerName}</p>
          {doc.signerIdNumber ? <p className="text-xs text-slate-500">{doc.signerIdNumber}</p> : null}
          {doc.signedAt ? <p className="text-xs text-slate-500">{new Date(doc.signedAt).toLocaleString(lang === "ar" ? "ar-IL" : "he-IL")}</p> : null}
        </section>
      ) : null}

      {doc.branding.footerNote || settings.website ? (
        <footer className="mt-8 border-t pt-3 text-xs text-slate-500">
          {doc.branding.footerNote ? <p className="whitespace-pre-wrap">{doc.branding.footerNote}</p> : null}
          {settings.website ? <p>{settings.website}</p> : null}
        </footer>
      ) : null}
    </article>
  );
}
