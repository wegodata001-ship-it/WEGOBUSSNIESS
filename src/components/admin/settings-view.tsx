"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { useAuth } from "@/components/providers/auth-provider";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { mutateBusiness } from "@/lib/admin/api";
import { departmentName, employeeName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { Users, Building2 } from "lucide-react";
import { DEFAULT_BUSINESS_VAT_RATE } from "@/lib/finance/vat";
import { BUSINESS_ROLES } from "@/types/roles";

const TABS = ["צוות", "מחלקות", "הרשאות", "פרויקטים", "קטגוריות", "הגדרות העסק"] as const;

export function SettingsControlView() {
  const { business } = useBusinessContext();
  const { refresh } = useAuth();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("צוות");
  const [openEmp, setOpenEmp] = useState(false);
  const [openDept, setOpenDept] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [deptName, setDeptName] = useState("");
  const [busy, setBusy] = useState(false);
  const [bizName, setBizName] = useState(business?.name ?? "");
  const [timezone, setTimezone] = useState(business?.timezone ?? "Asia/Jerusalem");
  const [language, setLanguage] = useState<string>(business?.language ?? "he");
  const [vatPercent, setVatPercent] = useState(String((data.settings.vatRate ?? DEFAULT_BUSINESS_VAT_RATE) * 100));
  const searchParams = useSearchParams();

  useEffect(() => {
    setVatPercent(String(Math.round((data.settings.vatRate || DEFAULT_BUSINESS_VAT_RATE) * 10000) / 100));
  }, [data.settings.vatRate]);

  useEffect(() => {
    if (searchParams.get("new") === "employee") {
      setTab("צוות");
      setOpenEmp(true);
    }
  }, [searchParams]);

  if (loading) return <Spinner label="טוען הגדרות…" />;

  async function createEmployee() {
    if (!business?.id || !displayName.trim() || !email.trim()) return;
    setBusy(true);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: "createEmployee",
        data: { displayName, email, phone, departmentId, role, firstName: displayName, lastName: "" },
      });
      setOpenEmp(false);
      setDisplayName("");
      setEmail("");
      setPhone("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function createDepartment() {
    if (!business?.id || !deptName.trim()) return;
    setBusy(true);
    try {
      await mutateBusiness({ businessId: business.id, action: "createDepartment", data: { name: deptName } });
      setOpenDept(false);
      setDeptName("");
      await reload();
    } catch {
      window.alert("לא ניתן ליצור מחלקה כפולה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="הגדרות ושליטה" subtitle="צוות, מחלקות, הרשאות והגדרות העסק" />
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-xl px-3 py-2 text-sm ${tab === item ? "bg-[var(--brand-primary)] text-white" : "bg-white text-slate-600"}`}>
            {item}
          </button>
        ))}
      </div>

      {tab === "צוות" ? (
        <SectionCard title="צוות" action={<PrimaryButton onClick={() => setOpenEmp(true)}>+ הוסף עובד</PrimaryButton>}>
          {data.employees.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    {["שם", "אימייל", "טלפון", "מחלקה", "תפקיד", "סטטוס", "פעולות"].map((item) => <th key={item} className="py-2 text-start">{item}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((employee) => {
                    const member = data.members.find((item) => item.employeeId === employee.id);
                    return (
                      <tr key={employee.id} className="border-t border-slate-100">
                        <td className="py-2">{employee.displayName}</td>
                        <td className="py-2">{employee.email}</td>
                        <td className="py-2">{employee.phone || "—"}</td>
                        <td className="py-2">{departmentName(data.departments, employee.departmentId)}</td>
                        <td className="py-2">{labelOf(member?.role ?? "EMPLOYEE")}</td>
                        <td className="py-2"><StatusBadge value={employee.status} label={labelOf(employee.status)} /></td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            <GhostButton onClick={() => {
                              if (!business?.id) return;
                              const next = window.prompt("שם", employee.displayName);
                              if (!next) return;
                              void mutateBusiness({ businessId: business.id, action: "updateEmployee", id: employee.id, data: { displayName: next, firstName: next, role: member?.role } }).then(reload);
                            }}>עריכה</GhostButton>
                            <GhostButton onClick={() => {
                              if (!business?.id) return;
                              void mutateBusiness({ businessId: business.id, action: "updateEmployee", id: employee.id, data: { displayName: employee.displayName, status: employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", role: member?.role } }).then(reload);
                            }}>{employee.status === "ACTIVE" ? "השבתה" : "הפעלה"}</GhostButton>
                            <select className="h-10 rounded-xl border border-slate-200 px-2 text-xs" defaultValue={employee.departmentId ?? ""} onChange={(event) => {
                              if (!business?.id) return;
                              void mutateBusiness({ businessId: business.id, action: "updateEmployee", id: employee.id, data: { displayName: employee.displayName, departmentId: event.target.value, role: member?.role } }).then(reload);
                            }}>
                              <option value="">מחלקה</option>
                              {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                            <select className="h-10 rounded-xl border border-slate-200 px-2 text-xs" defaultValue={member?.role ?? "EMPLOYEE"} onChange={(event) => {
                              if (!business?.id) return;
                              void mutateBusiness({ businessId: business.id, action: "updateEmployee", id: employee.id, data: { displayName: employee.displayName, role: event.target.value } }).then(reload);
                            }}>
                              {BUSINESS_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={Users} title="אין עובדים להצגה" />}
        </SectionCard>
      ) : null}

      {tab === "מחלקות" ? (
        <SectionCard title="מחלקות" action={<PrimaryButton onClick={() => setOpenDept(true)}>+ מחלקה</PrimaryButton>}>
          {data.departments.length ? data.departments.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-t border-slate-100 py-2 first:border-0">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-slate-500">{item.isActive ? "פעילה" : "מושבתת"}</p>
              </div>
              <div className="flex gap-2">
                <GhostButton onClick={() => {
                  const next = window.prompt("שם מחלקה", item.name);
                  if (!next || !business?.id) return;
                  void mutateBusiness({ businessId: business.id, action: "updateDepartment", id: item.id, data: { name: next, isActive: item.isActive } }).then(reload).catch(() => window.alert("שם כפול"));
                }}>עריכה</GhostButton>
                <GhostButton onClick={() => {
                  if (!business?.id) return;
                  void mutateBusiness({ businessId: business.id, action: "updateDepartment", id: item.id, data: { name: item.name, isActive: !item.isActive } }).then(reload);
                }}>{item.isActive ? "השבתה" : "הפעלה"}</GhostButton>
                <GhostButton onClick={() => {
                  if (!business?.id) return;
                  void mutateBusiness({ businessId: business.id, action: "deleteDepartment", id: item.id })
                    .then(reload)
                    .catch((error: Error) => window.alert(error.message === "DEPARTMENT_IN_USE"
                      ? "לא ניתן למחוק מחלקה שמקושרת למשימות, עובדים או פרויקטים. אפשר להשבית אותה."
                      : "המחיקה נכשלה"));
                }}>מחיקה</GhostButton>
              </div>
            </div>
          )) : <EmptyState icon={Building2} title="אין מחלקות מוגדרות" />}
        </SectionCard>
      ) : null}

      {tab === "הרשאות" ? (
        <SectionCard title="הרשאות לפי תפקיד">
          {data.members.map((member) => (
            <p key={member.userId} className="border-t border-slate-100 py-2 text-sm first:border-0">
              {member.displayName || employeeName(data.employees, member.employeeId)} · {member.role} · {member.permissions.length} הרשאות
            </p>
          ))}
        </SectionCard>
      ) : null}

      {tab === "פרויקטים" ? (
        <SectionCard title="פרויקטים" action={<Link href="/projects"><PrimaryButton>ניהול מלא</PrimaryButton></Link>}>
          {data.projects.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-t border-slate-100 py-2 first:border-0">
              <p className="text-sm">{item.name} · {labelOf(item.status)}{item.isActive ? "" : " · ארכיון"}</p>
              <div className="flex gap-2">
                <GhostButton onClick={() => {
                  if (!business?.id) return;
                  void mutateBusiness({
                    businessId: business.id,
                    action: item.isActive ? "archiveProject" : "restoreProject",
                    id: item.id,
                  }).then(reload);
                }}>{item.isActive ? "ארכיון" : "שחזור"}</GhostButton>
              </div>
            </div>
          ))}
        </SectionCard>
      ) : null}

      {tab === "קטגוריות" ? (
        <SectionCard title="קטגוריות מסמכים">
          <p className="text-sm text-slate-600">הצעת מחיר, חשבונית, חוזה, בריף, עיצוב, מסמך לקוח, אחר.</p>
        </SectionCard>
      ) : null}

      {tab === "הגדרות העסק" ? (
        <SectionCard title="הגדרות העסק">
          <div className="grid max-w-xl gap-3">
            <Field label="שם העסק"><input className={inputClass} value={bizName} onChange={(event) => setBizName(event.target.value)} /></Field>
            <Field label="אזור זמן"><input className={inputClass} value={timezone} onChange={(event) => setTimezone(event.target.value)} /></Field>
            <Field label="שפה"><input className={inputClass} value={language} onChange={(event) => setLanguage(event.target.value)} /></Field>
            <Field label="מע״מ (%)">
              <input className={inputClass} inputMode="decimal" value={vatPercent} onChange={(event) => setVatPercent(event.target.value)} />
            </Field>
            <PrimaryButton disabled={busy} onClick={() => {
              if (!business?.id) return;
              setBusy(true);
              void mutateBusiness({
                businessId: business.id,
                action: "updateBusiness",
                data: { name: bizName, timezone, language, vatRate: Number(vatPercent) / 100 },
              }).then(() => refresh()).finally(() => setBusy(false));
            }}>שמירת הגדרות</PrimaryButton>
          </div>
        </SectionCard>
      ) : null}

      {openEmp ? (
        <Modal title="הוספת עובד" onClose={() => setOpenEmp(false)}>
          <div className="grid gap-3">
            <Field label="שם"><input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></Field>
            <Field label="אימייל"><input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <Field label="טלפון"><input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
            <Field label="מחלקה">
              <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                <option value="">ללא</option>
                {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="תפקיד">
              <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value)}>
                {BUSINESS_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <p className="text-xs text-slate-500">סיסמה לא מוצגת ולא נשמרת בטופס. החשבון נוצר ב-Firebase Auth.</p>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setOpenEmp(false)}>ביטול</GhostButton>
              <PrimaryButton disabled={busy} onClick={() => void createEmployee()}>שמירה</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {openDept ? (
        <Modal title="מחלקה חדשה" onClose={() => setOpenDept(false)}>
          <Field label="שם"><input className={inputClass} value={deptName} onChange={(event) => setDeptName(event.target.value)} /></Field>
          <div className="mt-4 flex justify-end gap-2">
            <GhostButton onClick={() => setOpenDept(false)}>ביטול</GhostButton>
            <PrimaryButton disabled={busy} onClick={() => void createDepartment()}>שמירה</PrimaryButton>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
