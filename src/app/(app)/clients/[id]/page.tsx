"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { formatIls } from "@/lib/finance/money";

export default function ClientCardPage() {
  const params = useParams<{ id: string }>();
  const { business } = useBusinessContext();
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const client = data.clients.find((item) => item.id === params.id);
  const docs = data.businessDocs.filter((item) => item.clientId === params.id);
  const projects = data.projects.filter((item) => client && item.clientName === client.name);
  if (loading) return <p>טוען…</p>;
  if (!client) return <p>הלקוח לא נמצא</p>;
  return (
    <div className="space-y-5">
      <PageHeader title={client.name} subtitle={[client.phone, client.email, client.taxId].filter(Boolean).join(" · ")} />
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">מסמכים</h2>
        {docs.length ? docs.map((doc) => (
          <Link key={doc.id} href={`/documents/${doc.id}`} className="flex items-center justify-between border-t border-slate-100 py-2 text-sm first:border-0">
            <span>{doc.number} · {doc.title}</span>
            <span className="flex items-center gap-2">
              <StatusBadge value={doc.status} label={labelOf(doc.status)} />
              {formatIls(doc.totals.total, "")}
            </span>
          </Link>
        )) : <p className="text-sm text-slate-500">אין מסמכים ללקוח</p>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">פרויקטים</h2>
        {projects.length ? projects.map((item) => (
          <Link key={item.id} href={`/projects/${item.id}`} className="block border-t border-slate-100 py-2 text-sm first:border-0">{item.name}</Link>
        )) : <p className="text-sm text-slate-500">אין פרויקטים</p>}
      </section>
    </div>
  );
}
