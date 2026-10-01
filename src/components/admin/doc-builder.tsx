"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DocPreview } from "@/components/admin/doc-preview";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { labelOf } from "@/lib/admin/labels";
import { mutateBusiness } from "@/lib/admin/api";
import { useBusinessCatalog } from "@/lib/admin/catalog";
import { calculateDocumentTotals, emptyLine } from "@/lib/docs/totals";
import { formatIls } from "@/lib/finance/money";
import type { BusinessDocLine, BusinessDocumentRecord, DocPriceMode } from "@/types/business-doc";

export function DocumentBuilder({ documentId }: { documentId: string }) {
  const { business } = useBusinessContext();
  const { t } = useI18n();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const current = data.businessDocs.find((item) => item.id === documentId);
  const [draft, setDraft] = useState<BusinessDocumentRecord | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [taskQuery, setTaskQuery] = useState("");
  const [openClient, setOpenClient] = useState(false);
  const [openTask, setOpenTask] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", phone: "", email: "", taxId: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const doc = draft ?? current;
  const totals = useMemo(
    () => doc ? calculateDocumentTotals(doc) : null,
    [doc],
  );

  if (loading) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;
  if (!doc || !business) return <p className="text-sm text-slate-500">{t("empty.board")}</p>;

  const clients = data.clients.filter((item) => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return true;
    return `${item.name} ${item.email ?? ""} ${item.phone ?? ""}`.toLowerCase().includes(q);
  });
  const clientProjects = data.projects.filter((item) => !doc.clientName || item.clientName === doc.clientName || item.id === doc.projectId);
  const tasks = data.tasks.filter((item) => {
    const q = taskQuery.trim().toLowerCase();
    if (!q) return true;
    return item.title.toLowerCase().includes(q);
  });

  function update(patch: Partial<BusinessDocumentRecord>) {
    setDraft({ ...doc!, ...patch, totals: calculateDocumentTotals({ ...doc!, ...patch }) });
  }

  function updateLine(id: string, patch: Partial<BusinessDocLine>) {
    update({ lines: doc!.lines.map((line) => line.id === id ? { ...line, ...patch } : line) });
  }

  async function save() {
    if (!business?.id || !doc) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await mutateBusiness({
        businessId: business.id,
        action: "updateBusinessDoc",
        id: doc.id,
        data: {
          ...doc,
          lines: doc.lines.map((line) => ({ ...line, saveToCatalog: Boolean((line as BusinessDocLine & { saveToCatalog?: boolean }).saveToCatalog) })),
        },
      });
      if (result.newVersion) {
        window.location.href = `/documents/${result.id}`;
        return;
      }
      setDraft(null);
      await reload();
      setMessage("המסמך נשמר");
    } catch {
      setMessage("השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function createClient() {
    if (!business?.id || !newClient.name.trim()) return;
    setBusy(true);
    try {
      const created = await mutateBusiness({
        businessId: business.id,
        action: "createClient",
        data: newClient,
      });
      const client = created.client as { id?: string; name?: string; phone?: string | null; email?: string | null; taxId?: string | null; address?: string | null } | undefined;
      update({
        clientId: created.id ?? client?.id ?? null,
        clientName: newClient.name,
        clientPhone: newClient.phone || null,
        clientEmail: newClient.email || null,
        clientTaxId: newClient.taxId || null,
        clientAddress: newClient.address || null,
      });
      setOpenClient(false);
      setNewClient({ name: "", phone: "", email: "", taxId: "", address: "" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const previewDoc = { ...doc, totals: totals ?? doc.totals };

  return (
    <div className="space-y-5">
      <PageHeader
        title={doc.title || t("docs.edit")}
        subtitle={`${doc.number} · ${labelOf(doc.status)}${doc.frozen ? ` · ${t("docs.locked")}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/documents" className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-sm">{t("common.close")}</Link>
            <Link href={`/documents/${doc.id}/print`} className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-sm">PDF</Link>
            <PrimaryButton disabled={busy} onClick={() => void save()}>{t("docs.saveDraft")}</PrimaryButton>
          </div>
        }
      />
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <Field label={t("docs.title")}><input className={inputClass} value={doc.title} onChange={(event) => update({ title: event.target.value })} /></Field>
          <Field label={t("docs.language")}>
            <select className={inputClass} value={doc.language === "ar" ? "ar" : "he"} onChange={(event) => update({ language: event.target.value === "ar" ? "ar" : "he" })}>
              <option value="he">{t("docs.languageHe")}</option>
              <option value="ar">{t("docs.languageAr")}</option>
            </select>
          </Field>
          <Field label={t("docs.intro")}><textarea className={`${inputClass} h-24 py-2`} value={doc.intro} onChange={(event) => update({ intro: event.target.value })} /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("docs.date")}><input className={inputClass} value={doc.date} onChange={(event) => update({ date: event.target.value })} /></Field>
            <Field label={t("docs.validDays")}><input className={inputClass} inputMode="numeric" value={String(doc.validDays)} onChange={(event) => update({ validDays: Number(event.target.value) || 0 })} /></Field>
          </div>

          <Field label={t("common.client")}>
            <input className={inputClass} placeholder={t("docs.searchClient")} value={clientQuery} onChange={(event) => setClientQuery(event.target.value)} />
            <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-100">
              {clients.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`block w-full px-3 py-2 text-start text-sm hover:bg-slate-50 ${doc.clientId === item.id ? "bg-slate-100" : ""}`}
                  onClick={() => update({
                    clientId: item.id,
                    clientName: item.name,
                    clientPhone: item.phone,
                    clientEmail: item.email,
                    clientTaxId: item.taxId,
                    clientAddress: item.address,
                  })}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <div className="mt-2"><GhostButton onClick={() => setOpenClient(true)}>+ לקוח חדש</GhostButton></div>
          </Field>

          <Field label="פרויקט">
            <select className={inputClass} value={doc.projectId ?? ""} onChange={(event) => update({ projectId: event.target.value || null })}>
              <option value="">ללא</option>
              {clientProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <div className="mt-2">
              <GhostButton onClick={() => {
                const category = data.departmentCategories.find((item) => item.isActive);
                if (!business.id || !category) {
                  window.alert("כדי ליצור פרויקט יש להוסיף קטגוריה בהגדרות");
                  return;
                }
                void mutateBusiness({
                  businessId: business.id,
                  action: "createProject",
                  data: {
                    name: `פרויקט ${doc.clientName || doc.title || "חדש"}`,
                    clientName: doc.clientName,
                    categoryId: category.id,
                    departmentId: category.departmentId,
                  },
                }).then((created) => {
                  if (created.id) update({ projectId: created.id });
                  return reload();
                });
              }}>+ פרויקט חדש</GhostButton>
            </div>
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">משימות ושירותים</p>
              <div className="flex gap-2">
                <GhostButton onClick={() => setOpenTask(true)}>בחר משימה קיימת</GhostButton>
                <GhostButton onClick={() => update({ lines: [...doc.lines, emptyLine()] })}>+ כתוב משימה חדשה</GhostButton>
              </div>
            </div>
            <div className="grid gap-3">
              {doc.lines.map((line) => (
                <div key={line.id} className="rounded-xl border border-slate-100 p-3">
                  <input className={inputClass} placeholder="שם המשימה" value={line.title} onChange={(event) => updateLine(line.id, { title: event.target.value })} />
                  <textarea className={`${inputClass} mt-2 h-16 py-2`} placeholder="תיאור" value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} />
                  <input className={`${inputClass} mt-2`} placeholder="הערה" value={line.note} onChange={(event) => updateLine(line.id, { note: event.target.value })} />
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <input className={inputClass} inputMode="numeric" value={String(line.qty)} onChange={(event) => updateLine(line.id, { qty: Number(event.target.value) || 0 })} />
                    <input className={inputClass} inputMode="decimal" value={String(line.unitPrice)} onChange={(event) => updateLine(line.id, { unitPrice: Number(event.target.value) || 0 })} />
                    <select className={inputClass} value={line.priceMode} onChange={(event) => updateLine(line.id, { priceMode: event.target.value as DocPriceMode })}>
                      <option value="UNIT">מחיר לפי יחידה</option>
                      <option value="INCLUDED">מחיר כלול</option>
                      <option value="NONE">ללא מחיר</option>
                    </select>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean((line as BusinessDocLine & { saveToCatalog?: boolean }).saveToCatalog)}
                      onChange={(event) => updateLine(line.id, { saveToCatalog: event.target.checked } as Partial<BusinessDocLine>)}
                    />
                    שמור גם במאגר המשימות
                  </label>
                </div>
              ))}
            </div>
            {data.serviceItems.length ? (
              <p className="mt-2 text-xs text-slate-500">מאגר שירותים: {data.serviceItems.map((item) => item.title).join(" · ")}</p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="הנחה">
              <input className={inputClass} inputMode="decimal" value={String(doc.discount)} onChange={(event) => update({ discount: Number(event.target.value) || 0 })} />
            </Field>
            <Field label="סוג הנחה">
              <select className={inputClass} value={doc.discountType} onChange={(event) => update({ discountType: event.target.value as "AMOUNT" | "PERCENT" })}>
                <option value="AMOUNT">סכום</option>
                <option value="PERCENT">אחוז</option>
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={doc.vatInclusive} onChange={(event) => update({ vatInclusive: event.target.checked })} />
            מחיר כולל מע״מ
          </label>
          {totals ? (
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p>לפני מע״מ: {formatIls(totals.beforeVat)}</p>
              <p>הנחה: {formatIls(totals.discount)}</p>
              <p>מע״מ {Math.round(totals.vatRate * 100)}%: {formatIls(totals.vat)}</p>
              <p className="font-semibold">לתשלום: {formatIls(totals.total)}</p>
            </div>
          ) : null}

          <Field label="תנאי ההצעה / החוזה">
            <textarea className={`${inputClass} h-32 py-2`} value={doc.terms} onChange={(event) => update({ terms: event.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {data.termsTemplates.map((item) => (
              <GhostButton key={item.id} onClick={() => update({ terms: item.body })}>{item.name}</GhostButton>
            ))}
            <GhostButton onClick={() => {
              if (!business.id || !doc.terms.trim()) return;
              void mutateBusiness({ businessId: business.id, action: "createTermsTemplate", data: { name: "תבנית תנאים", body: doc.terms } }).then(reload);
            }}>שמור כתבנית</GhostButton>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={doc.requiresSignature} onChange={(event) => update({ requiresSignature: event.target.checked })} />
            דרוש חתימת לקוח
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="צבע ראשי"><input className={inputClass} value={doc.branding.primaryColor} onChange={(event) => update({ branding: { ...doc.branding, primaryColor: event.target.value } })} /></Field>
            <Field label="גודל לוגו"><input className={inputClass} inputMode="numeric" value={String(doc.branding.logoSize)} onChange={(event) => update({ branding: { ...doc.branding, logoSize: Number(event.target.value) || 56 } })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={doc.branding.showLogo} onChange={(event) => update({ branding: { ...doc.branding, showLogo: event.target.checked } })} />
            הצג לוגו
          </label>
          <Field label="הערות תחתונות"><textarea className={`${inputClass} h-20 py-2`} value={doc.branding.footerNote} onChange={(event) => update({ branding: { ...doc.branding, footerNote: event.target.value } })} /></Field>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3">
          <p className="mb-2 text-sm font-medium text-slate-600">תצוגה מקדימה</p>
          <DocPreview doc={previewDoc} business={business} settings={data.settings} />
        </div>
      </div>

      {openClient ? (
        <Modal title="לקוח חדש" onClose={() => setOpenClient(false)}>
          <div className="grid gap-3">
            <Field label="שם / שם עסק *"><input className={inputClass} value={newClient.name} onChange={(event) => setNewClient({ ...newClient, name: event.target.value })} /></Field>
            <Field label="טלפון"><input className={inputClass} value={newClient.phone} onChange={(event) => setNewClient({ ...newClient, phone: event.target.value })} /></Field>
            <Field label="אימייל"><input className={inputClass} value={newClient.email} onChange={(event) => setNewClient({ ...newClient, email: event.target.value })} /></Field>
            <Field label="ח.פ / עוסק"><input className={inputClass} value={newClient.taxId} onChange={(event) => setNewClient({ ...newClient, taxId: event.target.value })} /></Field>
            <Field label="כתובת"><input className={inputClass} value={newClient.address} onChange={(event) => setNewClient({ ...newClient, address: event.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setOpenClient(false)}>ביטול</GhostButton>
              <PrimaryButton disabled={busy} onClick={() => void createClient()}>שמירה והמשך</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {openTask ? (
        <Modal title="בחירת משימה" onClose={() => setOpenTask(false)}>
          <input className={inputClass} placeholder="חיפוש משימות במערכת..." value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} />
          <div className="mt-3 max-h-72 overflow-y-auto">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className="block w-full border-t border-slate-100 px-2 py-2 text-start text-sm"
                onClick={() => {
                  update({
                    lines: [...doc.lines, {
                      ...emptyLine(),
                      taskId: task.id,
                      title: task.title,
                      description: task.description,
                      unitPrice: task.priceBeforeVat ?? 0,
                      priceMode: task.priceBeforeVat == null ? "NONE" : "UNIT",
                    }],
                  });
                  setOpenTask(false);
                }}
              >
                {task.title}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
