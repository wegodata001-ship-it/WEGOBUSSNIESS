"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { DocumentsView } from "@/components/admin/documents-view";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, StatusBadge } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { mutateBusiness } from "@/lib/admin/api";
import { useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { getI18nLocale, translate } from "@/lib/i18n";
import { formatIls } from "@/lib/finance/money";
import { BUSINESS_DOC_KINDS, type BusinessDocKind, type BusinessDocumentRecord } from "@/types/business-doc";

export function DocumentsHub() {
  const { t } = useI18n();
  const { business, permissions, membership } = useBusinessContext();
  const filters = [
    { id: "", label: t("common.all") },
    { id: "QUOTE", label: t("docs.quotes") },
    { id: "CONTRACT", label: t("docs.contracts") },
    { id: "DRAFT", label: t("docs.drafts") },
    { id: "SENT", label: t("docs.sent") },
    { id: "SIGNED", label: t("docs.signed") },
  ] as const;
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const router = useRouter();
  const canManage = permissions.includes("documents.manage") || membership?.role === "BUSINESS_OWNER";
  const [tab, setTab] = useState<"docs" | "archive">("docs");
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<BusinessDocKind>("QUOTE");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    return data.businessDocs.filter((item) => {
      if (!filter) return true;
      if (filter === "QUOTE" || filter === "CONTRACT") return item.kind === filter;
      return item.status === filter;
    }).sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0));
  }, [data.businessDocs, filter]);

  async function create() {
    if (!business?.id) return;
    setBusy(true);
    try {
      const locale = getI18nLocale();
      const titleKey = kind === "CONTRACT" ? "docs.contract" : kind === "CUSTOM" ? "docs.custom" : "docs.quote";
      const title = `${translate(locale, titleKey)} ${translate(locale, "docs.new")}`;
      const created = await mutateBusiness({
        businessId: business.id,
        action: "createBusinessDoc",
        data: { kind, title, language: locale },
      });
      setOpen(false);
      if (created.id) router.push(`/documents/${created.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, doc: BusinessDocumentRecord) {
    if (!business?.id) return;
    setBusy(true);
    try {
      const result = await mutateBusiness({ businessId: business.id, action, id: doc.id });
      if (action === "sendBusinessDoc" && result.token) {
        const url = `${window.location.origin}/sign/${result.token}`;
        await navigator.clipboard.writeText(url).catch(() => undefined);
        window.alert(t("docs.sentAlert", { url }));
      }
      if (action === "duplicateBusinessDoc" && result.id) router.push(`/documents/${result.id}`);
      await reload();
    } catch {
      window.alert(t("docs.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label={t("docs.loading")} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.documents")}
        subtitle={t("docs.hubSubtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <GhostButton onClick={() => setTab(tab === "docs" ? "archive" : "docs")}>
              {tab === "docs" ? t("docs.fileArchive") : t("docs.quotesContracts")}
            </GhostButton>
            {tab === "docs" && canManage ? <PrimaryButton onClick={() => setOpen(true)}>+ {t("docs.newDocument")}</PrimaryButton> : null}
          </div>
        }
      />

          {tab === "archive" ? <DocumentsView embedded /> : (
        <>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id || "all"}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`min-h-11 rounded-full border px-3 text-sm ${filter === item.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {rows.length ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {[t("docs.colNumber"), t("common.type"), t("common.name"), t("common.client"), t("common.project"), t("common.amount"), t("common.status"), t("common.created"), t("docs.sentCol"), t("docs.signature"), t("common.actions")].map((item) => (
                      <th key={item} className="px-3 py-3 text-start">{item}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((doc) => (
                    <tr key={doc.id} className="border-t border-slate-100">
                      <td className="px-3 py-3">{doc.number}</td>
                      <td className="px-3 py-3">{labelOf(doc.kind)}</td>
                      <td className="px-3 py-3">{doc.title}</td>
                      <td className="px-3 py-3">{doc.clientId ? <Link className="text-[var(--brand-primary)]" href={`/clients/${doc.clientId}`}>{doc.clientName || "—"}</Link> : doc.clientName || "—"}</td>
                      <td className="px-3 py-3">{doc.projectId ? <Link className="text-[var(--brand-primary)]" href={`/projects/${doc.projectId}`}>{data.projects.find((item) => item.id === doc.projectId)?.name ?? "—"}</Link> : "—"}</td>
                      <td className="px-3 py-3">{formatIls(doc.totals.total, "—")}</td>
                      <td className="px-3 py-3"><StatusBadge value={doc.status} label={labelOf(doc.status)} /></td>
                      <td className="px-3 py-3">{doc.createdAt ? doc.createdAt.toLocaleDateString("he-IL") : "—"}</td>
                      <td className="px-3 py-3">{doc.sentAt ? doc.sentAt.toLocaleDateString("he-IL") : "—"}</td>
                      <td className="px-3 py-3">{doc.signedAt ? t("common.yes") : t("common.no")}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Link href={`/documents/${doc.id}`} className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-xs">{t("docs.viewEdit")}</Link>
                          <Link href={`/documents/${doc.id}/print`} className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-xs">PDF</Link>
                          {canManage ? <GhostButton disabled={busy} onClick={() => void act("duplicateBusinessDoc", doc)}>{t("docs.duplicate")}</GhostButton> : null}
                          {canManage ? <GhostButton disabled={busy} onClick={() => void act("sendBusinessDoc", doc)}>{t("common.send")}</GhostButton> : null}
                          {canManage ? <GhostButton disabled={busy} onClick={() => void act("deleteBusinessDoc", doc)}>{t("common.delete")}</GhostButton> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={FileText} title={t("docs.emptyBusiness")} action={canManage ? <PrimaryButton onClick={() => setOpen(true)}>+ {t("docs.newDocument")}</PrimaryButton> : undefined} />}
        </>
      )}

      {open ? (
        <Modal title={t("docs.newDocument")} onClose={() => setOpen(false)}>
          <div className="grid gap-3">
            <Field label={t("common.type")}>
              <div className="grid gap-2">
                {BUSINESS_DOC_KINDS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setKind(item)}
                    className={`min-h-11 rounded-xl border px-3 text-start text-sm ${kind === item ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}
                  >
                    {labelOf(item)}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setOpen(false)}>{t("common.cancel")}</GhostButton>
              <PrimaryButton disabled={busy} onClick={() => void create()}>{t("docs.continueBuilder")}</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
