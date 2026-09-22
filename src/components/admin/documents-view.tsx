"use client";

import { useMemo, useState } from "react";
import { FileArchive } from "lucide-react";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { deleteBusinessDocument, documentDownloadUrl, mutateBusiness, uploadBusinessDocument } from "@/lib/admin/api";
import { projectName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { DOCUMENT_CATEGORIES } from "@/types/document";

export function DocumentsView() {
  const { business } = useBusinessContext();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const [projectId, setProjectId] = useState("");
  const [clientName, setClientName] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [layout, setLayout] = useState<"table" | "cards">("table");

  const rows = useMemo(() => data.documents.filter((item) => {
    if (projectId && item.projectId !== projectId) return false;
    if (clientName && !item.clientName.includes(clientName)) return false;
    if (category && item.category !== category) return false;
    return true;
  }), [category, clientName, data.documents, projectId]);

  if (loading) return <Spinner label="טוען מסמכים…" />;

  async function upload() {
    if (!business?.id || !file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("businessId", business.id);
      form.set("file", file);
      form.set("name", name || file.name);
      form.set("projectId", projectId);
      form.set("clientName", clientName);
      form.set("category", category || "OTHER");
      form.set("note", note);
      await uploadBusinessDocument(form);
      setOpen(false);
      setName("");
      setNote("");
      setFile(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function openFile(id: string) {
    if (!business?.id) return;
    const result = await documentDownloadUrl(business.id, id);
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="ארכיון מסמכים"
        subtitle="העלאה, צפייה, הורדה וניהול מסמכי העסק"
        actions={<PrimaryButton onClick={() => setOpen(true)}>+ העלאת מסמך</PrimaryButton>}
      />
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-4">
        <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">כל הפרויקטים</option>
          {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input className={inputClass} placeholder="לקוח" value={clientName} onChange={(event) => setClientName(event.target.value)} />
        <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">כל הקטגוריות</option>
          {DOCUMENT_CATEGORIES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
        </select>
        <GhostButton onClick={() => setLayout(layout === "table" ? "cards" : "table")}>{layout === "table" ? "תצוגת כרטיסים" : "תצוגת טבלה"}</GhostButton>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={FileArchive} title="אין מסמכים בארכיון" action={<PrimaryButton onClick={() => setOpen(true)}>+ העלאת מסמך</PrimaryButton>} />
      ) : layout === "cards" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((doc) => (
            <article key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-medium">{doc.name}</p>
              <p className="mt-1 text-xs text-slate-500">{projectName(data.projects, doc.projectId)} · {labelOf(doc.category)}</p>
              <div className="mt-3 flex gap-2">
                <GhostButton onClick={() => void openFile(doc.id)}>צפייה / הורדה</GhostButton>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-3 text-start">שם</th>
                <th className="px-3 py-3 text-start">פרויקט</th>
                <th className="px-3 py-3 text-start">לקוח</th>
                <th className="px-3 py-3 text-start">קטגוריה</th>
                <th className="px-3 py-3 text-start">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doc) => (
                <tr key={doc.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{doc.name}</td>
                  <td className="px-3 py-3">{projectName(data.projects, doc.projectId)}</td>
                  <td className="px-3 py-3">{doc.clientName || "—"}</td>
                  <td className="px-3 py-3"><StatusBadge value={doc.category} label={labelOf(doc.category)} /></td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <GhostButton onClick={() => void openFile(doc.id)}>צפייה / הורדה</GhostButton>
                      <GhostButton onClick={() => {
                        const next = window.prompt("שם חדש", doc.name);
                        if (next && business?.id) void mutateBusiness({ businessId: business.id, action: "updateDocument", id: doc.id, data: { name: next } }).then(reload);
                      }}>שינוי שם</GhostButton>
                      <GhostButton onClick={() => {
                        const next = window.prompt("קטגוריה", doc.category);
                        if (next && business?.id) void mutateBusiness({ businessId: business.id, action: "updateDocument", id: doc.id, data: { category: next } }).then(reload);
                      }}>העברה לקטגוריה</GhostButton>
                      <GhostButton disabled={busy} onClick={() => {
                        if (!business?.id) return;
                        void deleteBusinessDocument(business.id, doc.id).then(reload);
                      }}>מחיקה</GhostButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <Modal title="העלאת מסמך" onClose={() => setOpen(false)}>
          <div className="grid gap-3">
            <Field label="שם"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="קובץ"><input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field>
            <Field label="פרויקט">
              <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">ללא</option>
                {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="לקוח"><input className={inputClass} value={clientName} onChange={(event) => setClientName(event.target.value)} /></Field>
            <Field label="קטגוריה">
              <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
                {DOCUMENT_CATEGORIES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
              </select>
            </Field>
            <Field label="הערה"><textarea className={`${inputClass} h-20 py-2`} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setOpen(false)}>ביטול</GhostButton>
              <PrimaryButton disabled={busy || !file} onClick={() => void upload()}>העלאה</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
