"use client";

import { useParams } from "next/navigation";
import { DocumentBuilder } from "@/components/admin/doc-builder";

export default function DocumentBuilderPage() {
  const params = useParams<{ id: string }>();
  return <DocumentBuilder documentId={params.id} />;
}
