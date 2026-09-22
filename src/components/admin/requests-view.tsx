"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { mutateBusiness } from "@/lib/admin/api";
import { employeeName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { todayInTimeZone } from "@/lib/dates/format";
import { REQUEST_TYPES, type LogisticsRequest } from "@/types/logistics";

export function RequestsView() {
  const { business } = useBusinessContext();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [type, setType] = useState("OTHER");
  const [amount, setAmount] = useState("");
  const [requestDate, setRequestDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<Record<string, string>>({});

  if (loading) return <Spinner label="טוען בקשות…" />;

  async function create() {
    if (!business?.id || !title.trim()) return;
    setBusy(true);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: "createRequest",
        data: { title, details, type, amount: amount ? Number(amount) : null, requestDate },
      });
      setOpen(false);
      setTitle("");
      setDetails("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function handle(item: LogisticsRequest, status: string) {
    if (!business?.id) return;
    setBusy(true);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: "handleRequest",
        id: item.id,
        data: { status, managerResponse: response[item.id] ?? "" },
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="בקשות משרד / לוגיסטיקה" subtitle="פתיחה, אישור, דחייה והשלמה של בקשות העובדים" actions={<PrimaryButton onClick={() => setOpen(true)}>+ בקשה חדשה</PrimaryButton>} />
      {data.requests.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {["עובד", "סוג", "פירוט", "תאריך", "סכום", "סטטוס", "מענה", "פעולות"].map((item) => (
                  <th key={item} className="px-3 py-3 text-start">{item}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.requests.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3">{employeeName(data.employees, item.requestedByEmployeeId)}</td>
                  <td className="px-3 py-3">{labelOf(item.type)}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.details}</p>
                  </td>
                  <td className="px-3 py-3">{item.requestDate ?? "—"}</td>
                  <td className="px-3 py-3">{item.amount ?? "—"}</td>
                  <td className="px-3 py-3"><StatusBadge value={item.status} label={labelOf(item.status)} /></td>
                  <td className="px-3 py-3">
                    <input className={inputClass} placeholder="מענה מנהל" value={response[item.id] ?? item.managerResponse} onChange={(event) => setResponse((current) => ({ ...current, [item.id]: event.target.value }))} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <GhostButton disabled={busy} onClick={() => void handle(item, "APPROVED")}>אישור</GhostButton>
                      <GhostButton disabled={busy} onClick={() => void handle(item, "REJECTED")}>דחייה</GhostButton>
                      <GhostButton disabled={busy} onClick={() => void handle(item, "NEED_INFO")}>בקש מידע</GhostButton>
                      <GhostButton disabled={busy} onClick={() => void handle(item, "FULFILLED")}>הושלם</GhostButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Truck} title="אין בקשות ממתינות לטיפול" action={<PrimaryButton onClick={() => setOpen(true)}>+ בקשה חדשה</PrimaryButton>} />
      )}

      {open ? (
        <Modal title="בקשה חדשה" onClose={() => setOpen(false)}>
          <div className="grid gap-3">
            <Field label="סוג">
              <select className={inputClass} value={type} onChange={(event) => setType(event.target.value)}>
                {REQUEST_TYPES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
              </select>
            </Field>
            <Field label="כותרת"><input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
            <Field label="פירוט"><textarea className={`${inputClass} h-24 py-2`} value={details} onChange={(event) => setDetails(event.target.value)} /></Field>
            <Field label="תאריך"><input className={inputClass} value={requestDate} onChange={(event) => setRequestDate(event.target.value)} /></Field>
            <Field label="סכום אם רלוונטי"><input className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setOpen(false)}>ביטול</GhostButton>
              <PrimaryButton disabled={busy} onClick={() => void create()}>שליחה</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
