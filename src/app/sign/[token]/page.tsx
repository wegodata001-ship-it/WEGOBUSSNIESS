"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DocPreview } from "@/components/admin/doc-preview";
import { Field, GhostButton, PrimaryButton, inputClass } from "@/components/admin/ui";
import { DEFAULT_BUSINESS_VAT_RATE } from "@/lib/finance/vat";
import type { BusinessDocumentRecord } from "@/types/business-doc";
import type { Business } from "@/types/business";
import type { BusinessSettings } from "@/types/notification";

export default function PublicSignPage() {
  const params = useParams<{ token: string }>();
  const [doc, setDoc] = useState<BusinessDocumentRecord | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerIdNumber, setSignerIdNumber] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    void fetch(`/api/public/docs/${params.token}`)
      .then((response) => response.json())
      .then((payload) => {
        setDoc(payload.doc ?? null);
        setBusiness(payload.business ?? null);
        setSettings(payload.settings ?? null);
      });
  }, [params.token]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  async function sign() {
    const canvas = canvasRef.current;
    if (!canvas || !signerName.trim()) {
      setError("יש למלא שם ולחתום");
      return;
    }
    const response = await fetch(`/api/public/docs/${params.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signerName,
        signerIdNumber,
        signature: canvas.toDataURL("image/png"),
      }),
    });
    if (!response.ok) {
      setError("החתימה נכשלה");
      return;
    }
    setDone(true);
  }

  if (!doc || !settings) return <p className="p-6">טוען מסמך…</p>;

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <DocPreview
        doc={doc}
        business={business ?? { name: "", primaryColor: "#2563eb", logoUrl: null }}
        settings={settings.vatRate ? settings : { ...settings, vatRate: DEFAULT_BUSINESS_VAT_RATE }}
      />
      {doc.requiresSignature && doc.status !== "SIGNED" && !done ? (
        <div className="mx-auto mt-6 max-w-[800px] rounded-2xl bg-white p-4">
          <h2 className="font-semibold">חתימה ואישור</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="שם החותם *"><input className={inputClass} value={signerName} onChange={(event) => setSignerName(event.target.value)} /></Field>
            <Field label="ת.ז / מספר מזהה"><input className={inputClass} value={signerIdNumber} onChange={(event) => setSignerIdNumber(event.target.value)} /></Field>
          </div>
          <p className="mt-3 text-sm">חתימה</p>
          <canvas
            ref={canvasRef}
            width={640}
            height={160}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50"
            onPointerDown={(event) => {
              drawing.current = true;
              const ctx = canvasRef.current?.getContext("2d");
              if (!ctx) return;
              const { x, y } = point(event);
              ctx.beginPath();
              ctx.moveTo(x, y);
            }}
            onPointerMove={(event) => {
              if (!drawing.current) return;
              const ctx = canvasRef.current?.getContext("2d");
              if (!ctx) return;
              const { x, y } = point(event);
              ctx.lineTo(x, y);
              ctx.stroke();
            }}
            onPointerUp={() => { drawing.current = false; }}
          />
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <div className="mt-3 flex justify-end gap-2">
            <GhostButton onClick={() => canvasRef.current?.getContext("2d")?.clearRect(0, 0, 640, 160)}>נקה</GhostButton>
            <PrimaryButton onClick={() => void sign()}>חתום ואשר</PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-[800px] text-center">
          <p className="text-sm text-slate-600">{doc.status === "SIGNED" || done ? "המסמך נחתם" : "תצוגת מסמך"}</p>
          <button type="button" onClick={() => window.print()} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">הורדת PDF</button>
        </div>
      )}
    </div>
  );
}
