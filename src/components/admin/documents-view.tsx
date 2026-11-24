"use client";

import { useMemo, useState } from "react";
import { FileArchive } from "lucide-react";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { deleteBusinessDocument, documentDownloadUrl, mutateBusiness, uploadBusinessDocument } from "@/lib/admin/api";
import { projectName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { DOCUMENT_CATEGORIES } from "@/types/document";

export function DocumentsView({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
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
  const [layout, setLayout] = useState<"table" | "cards">("cards");

  const rows = useMemo(() => data.documents.filter((item) => {
    if (projectId && item.projectId !== projectId) return false;
    if (clientName && !item.clientName.includes(clientName)) return false;
    if (category && item.category !== category) return false;
    return true;
  }), [category, clientName, data.documents, projectId]);

  if (loading) return <Spinner label={t("docs.loading")} />;

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
      {embedded ? (
        <div className="flex justify-end"><PrimaryButton onClick={() => setOpen(true)}>+ {t("archive.upload")}</PrimaryButton></div>
      ) : (
      <PageHeader
        title={t("archive.title")}
        subtitle={t("archive.subtitle")}
        actions={<PrimaryButton onClick={() => setOpen(true)}>+ {t("archive.upload")}</PrimaryButton>}
      />
      )}
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-4">
        <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">{t("meetings.allProjects")}</option>
          {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input className={inputClass} placeholder={t("common.client")} value={clientName} onChange={(event) => setClientName(event.target.value)} />
        <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">{t("projects.allCategories")}</option>
          {DOCUMENT_CATEGORIES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
        </select>
        <GhostButton onClick={() => setLayout(layout === "table" ? "cards" : "table")}>{layout === "table" ? t("archive.cardsView") : t("archive.tableView")}</GhostButton>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={FileArchive} title={t("archive.empty")} action={<PrimaryButton onClick={() => setOpen(true)}>+ {t("archive.upload")}</PrimaryButton>} />
      ) : (
        <>
          <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${layout === "table" ? "md:hidden" : ""}`}>
            {rows.map((doc) => (
              <article key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-medium">{doc.name}</p>
                <p className="mt-1 text-xs text-slate-500">{projectName(data.projects, doc.projectId)} · {labelOf(doc.category)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <GhostButton onClick={() => void openFile(doc.id)}>{t("archive.viewDownload")}</GhostButton>
                  <GhostButton onClick={() => {
                    const next = window.prompt(t("archive.promptName"), doc.name);
                    if (next && business?.id) void mutateBusiness({ businessId: business.id, action: "updateDocument", id: doc.id, data: { name: next } }).then(reload);
                  }}>{t("archive.rename")}</GhostButton>
                  <GhostButton disabled={busy} onClick={() => {
                    if (!business?.id) return;
                    void deleteBusinessDocument(business.id, doc.id).then(reload);
                  }}>{t("common.delete")}</GhostButton>
                </div>
              </article>
            ))}
          </div>
          {layout === "table" ? (
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-3 text-start">{t("common.name")}</th>
                    <th className="px-3 py-3 text-start">{t("common.project")}</th>
                    <th className="px-3 py-3 text-start">{t("common.client")}</th>
                    <th className="px-3 py-3 text-start">{t("common.category")}</th>
                    <th className="px-3 py-3 text-start">{t("common.actions")}</th>
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
                          <GhostButton onClick={() => void openFile(doc.id)}>{t("archive.viewDownload")}</GhostButton>
                          <GhostButton onClick={() => {
                            const next = window.prompt(t("archive.promptName"), doc.name);
                            if (next && business?.id) void mutateBusiness({ businessId: business.id, action: "updateDocument", id: doc.id, data: { name: next } }).then(reload);
                          }}>{t("archive.rename")}</GhostButton>
                          <GhostButton onClick={() => {
                            const next = window.prompt(t("archive.promptCategory"), doc.category);
                            if (next && business?.id) void mutateBusiness({ businessId: business.id, action: "updateDocument", id: doc.id, data: { category: next } }).then(reload);
                          }}>{t("archive.moveCategory")}</GhostButton>
                          <GhostButton disabled={busy} onClick={() => {
                            if (!business?.id) return;
                            void deleteBusinessDocument(business.id, doc.id).then(reload);
                          }}>{t("common.delete")}</GhostButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}

      {open ? (
        <Modal title={t("archive.upload")} onClose={() => setOpen(false)}>
          <div className="grid gap-3">
            <Field label={t("common.name")}><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label={t("common.file")}><input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field>
            <Field label={t("common.project")}>
              <select className={inputClass} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">{t("projects.none")}</option>
                {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label={t("common.client")}><input className={inputClass} value={clientName} onChange={(event) => setClientName(event.target.value)} /></Field>
            <Field label={t("common.category")}>
              <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
                {DOCUMENT_CATEGORIES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
              </select>
            </Field>
            <Field label={t("common.note")}><textarea className={`${inputClass} h-20 py-2`} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setOpen(false)}>{t("common.cancel")}</GhostButton>
              <PrimaryButton disabled={busy || !file} onClick={() => void upload()}>{t("archive.upload")}</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
