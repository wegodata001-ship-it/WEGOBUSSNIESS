"use client";

import { useParams } from "next/navigation";
import { DocPreview } from "@/components/admin/doc-preview";
import { useBusinessContext } from "@/components/providers/business-context";
import { useBusinessCatalog } from "@/lib/admin/catalog";

export default function DocumentPrintPage() {
  const params = useParams<{ id: string }>();
  const { business } = useBusinessContext();
  const { data, loading } = useBusinessCatalog(business?.id ?? null);
  const doc = data.businessDocs.find((item) => item.id === params.id);
  if (loading) return <p className="p-6">טוען…</p>;
  if (!doc) return <p className="p-6">המסמך לא נמצא</p>;
  return (
    <div className="min-h-screen bg-white p-4 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <button type="button" onClick={() => window.print()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">הפק PDF</button>
      </div>
      <DocPreview doc={doc} business={business} settings={data.settings} />
    </div>
  );
}
