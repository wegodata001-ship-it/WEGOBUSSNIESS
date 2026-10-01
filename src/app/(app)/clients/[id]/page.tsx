"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { pricedTaskFinance } from "@/lib/finance/summary";
import { formatIls } from "@/lib/finance/money";

export default function ClientCardPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const { business, membership, permissions } = useBusinessContext();
  const canViewFinance = permissions.includes("finance.view") || membership?.role === "BUSINESS_OWNER" || membership?.role === "MANAGER";
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const client = data.clients.find((item) => item.id === params.id);
  const docs = data.businessDocs.filter((item) => item.clientId === params.id);
  const projects = data.projects.filter((item) => client && item.clientName === client.name);
  const projectIds = new Set(projects.map((item) => item.id));
  const clientTasks = data.tasks.filter((task) => task.projectId && projectIds.has(task.projectId));
  const finance = pricedTaskFinance(clientTasks);
  if (loading) return <p>{t("common.loading")}</p>;
  if (!client) return <p>{t("common.failed")}</p>;
  return (
    <div className="space-y-5">
      <PageHeader title={client.name} subtitle={[client.phone, client.email, client.taxId].filter(Boolean).join(" · ")} />
      {canViewFinance ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">{t("finance.section")}</h2>
          <p className="mt-3 flex justify-between text-sm"><span>{t("finance.priced")}</span><span>{formatIls(finance.total)}</span></p>
          <p className="mt-1 flex justify-between text-sm"><span>{t("finance.received")}</span><span>{formatIls(finance.received)}</span></p>
          <p className="mt-1 flex justify-between text-sm font-medium"><span>{t("finance.open")}</span><span>{formatIls(finance.open)}</span></p>
          <Link href="/movements" className="mt-3 inline-flex text-sm font-medium text-[#2563EB]">{t("finance.showMovements")}</Link>
        </section>
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">{t("nav.documents")}</h2>
        {docs.length ? docs.map((doc) => (
          <Link key={doc.id} href={`/documents/${doc.id}`} className="flex items-center justify-between border-t border-slate-100 py-2 text-sm first:border-0">
            <span>{doc.number} · {doc.title}</span>
            <span className="flex items-center gap-2">
              <StatusBadge value={doc.status} label={labelOf(doc.status)} />
              {canViewFinance ? formatIls(doc.totals.total, "") : null}
            </span>
          </Link>
        )) : <p className="text-sm text-slate-500">{t("empty.noAccess")}</p>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">{t("nav.projects")}</h2>
        {projects.length ? projects.map((item) => (
          <Link key={item.id} href={`/projects/${item.id}`} className="block border-t border-slate-100 py-2 text-sm first:border-0">{item.name}</Link>
        )) : <p className="text-sm text-slate-500">—</p>}
      </section>
    </div>
  );
}
