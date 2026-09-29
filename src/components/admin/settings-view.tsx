"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Users, Building2, Tags } from "lucide-react";
import { BusinessSettingsForm } from "@/components/admin/business-settings-form";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { ColorPicker } from "@/components/admin/form-chips";
import { useAuth } from "@/components/providers/auth-provider";
import { useBusinessContext } from "@/components/providers/business-context";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { mutateBusiness } from "@/lib/admin/api";
import { categoriesForDepartment, departmentColorHex } from "@/lib/admin/department-categories";
import { departmentName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import type { CalendarColor } from "@/lib/admin/palette";
import { BUSINESS_ROLES } from "@/types/roles";
import type { Department } from "@/types/department";
import type { Employee } from "@/types/employee";

const TABS = ["צוות", "מחלקות", "קטגוריות", "הגדרות העסק"] as const;

function mutationMessage(code: string) {
  if (code === "PASSWORD_REQUIRED") return "יש להזין סיסמה";
  if (code === "WEAK_PASSWORD") return "הסיסמה חייבת להכיל לפחות 6 תווים";
  if (code === "AUTH_EMAIL_EXISTS") return "כבר קיים משתמש ב-Firebase עם האימייל הזה. העובד לא נוצר.";
  if (code === "DUPLICATE_EMPLOYEE") return "עובד עם האימייל הזה כבר קיים";
  if (code === "AUTH_CREATE_FAILED") return "יצירת המשתמש ב-Firebase נכשלה. העובד לא נוצר.";
  if (code === "INVALID_EMAIL") return "כתובת האימייל אינה תקינה";
  if (code === "FORBIDDEN") return "אין הרשאה לבצע פעולה זו";
  if (code === "NAME_REQUIRED") return "יש להזין שם";
  if (code === "EMAIL_REQUIRED") return "יש להזין אימייל";
  if (code === "DUPLICATE_DEPARTMENT") return "מחלקה בשם זה כבר קיימת";
  if (code === "DUPLICATE_CATEGORY") return "קטגוריה בשם זה כבר קיימת במחלקה";
  if (code === "DEPARTMENT_IN_USE") return "לא ניתן למחוק מחלקה שמקושרת למשימות, עובדים או פרויקטים. אפשר להשבית אותה.";
  if (code === "CATEGORY_IN_USE") return "קטגוריה זו משויכת לפרויקטים. יש להעביר אותם לפני המחיקה.";
  return "הפעולה נכשלה";
}

type EmployeeDraft = {
  id?: string;
  displayName: string;
  email: string;
  phone: string;
  departmentId: string;
  role: string;
  status: "ACTIVE" | "INACTIVE";
  password: string;
};

const EMPTY_EMPLOYEE: EmployeeDraft = {
  displayName: "",
  email: "",
  phone: "",
  departmentId: "",
  role: "EMPLOYEE",
  status: "ACTIVE",
  password: "",
};

export function SettingsControlView() {
  const { business, permissions, membership } = useBusinessContext();
  const { refresh } = useAuth();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const searchParams = useSearchParams();
  const owner = membership?.role === "BUSINESS_OWNER";
  const canTeam = permissions.includes("employees.manage") || owner;
  const canDept = permissions.includes("departments.manage") || owner;
  const canBiz = permissions.includes("settings.manage") || owner;
  const tabs = TABS.filter((tab) => tab !== "הגדרות העסק" || canBiz);

  const [tab, setTab] = useState<(typeof TABS)[number]>("צוות");
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<{ id: string; name: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [openDept, setOpenDept] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptColor, setDeptColor] = useState<CalendarColor>("BLUE");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [openCategory, setOpenCategory] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDept, setCatDept] = useState("");
  const [reassign, setReassign] = useState<{ id: string; name: string; count: number; moveTo: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchParams.get("new") === "employee" && canTeam) {
      setTab("צוות");
      setEmployeeDraft({ ...EMPTY_EMPLOYEE });
    }
  }, [canTeam, searchParams]);

  const employees = useMemo(() => data.employees, [data.employees]);

  if (loading) return <Spinner label="טוען הגדרות…" />;
  if (!canTeam && !canDept && !canBiz) {
    return <EmptyState icon={Users} title="אין הרשאה להגדרות ושליטה" />;
  }

  async function saveEmployee() {
    if (!business?.id || !employeeDraft) return;
    if (!employeeDraft.displayName.trim() || !employeeDraft.email.trim()) {
      setError(mutationMessage(!employeeDraft.displayName.trim() ? "NAME_REQUIRED" : "EMAIL_REQUIRED"));
      return;
    }
    if (!employeeDraft.id && !employeeDraft.password) {
      setError(mutationMessage("PASSWORD_REQUIRED"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutateBusiness({
        businessId: business.id,
        action: employeeDraft.id ? "updateEmployee" : "createEmployee",
        id: employeeDraft.id,
        data: {
          displayName: employeeDraft.displayName,
          firstName: employeeDraft.displayName,
          lastName: "",
          email: employeeDraft.email,
          phone: employeeDraft.phone,
          departmentId: employeeDraft.departmentId,
          role: employeeDraft.role,
          status: employeeDraft.status,
          active: employeeDraft.status === "ACTIVE",
          ...(employeeDraft.id ? {} : { password: employeeDraft.password }),
        },
      });
      setEmployeeDraft(null);
      setShowPassword(false);
      await reload();
    } catch (caught) {
      setError(mutationMessage(caught instanceof Error ? caught.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (!business?.id || !passwordDraft) return;
    setBusy(true);
    setError("");
    try {
      await mutateBusiness({
        businessId: business.id,
        action: "resetEmployeePassword",
        id: passwordDraft.id,
        data: { password: passwordDraft.password },
      });
      setPasswordDraft(null);
      setShowResetPassword(false);
    } catch (caught) {
      setError(mutationMessage(caught instanceof Error ? caught.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function createDepartment() {
    if (!business?.id || !deptName.trim()) return;
    setBusy(true);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: "createDepartment",
        data: { name: deptName, color: deptColor },
      });
      setOpenDept(false);
      setDeptName("");
      setDeptColor("BLUE");
      await reload();
    } catch (caught) {
      window.alert(mutationMessage(caught instanceof Error ? caught.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(department: Department) {
    const name = (categoryDrafts[department.id] ?? "").trim();
    if (!business?.id || !name) return;
    setBusy(true);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: "createDepartmentCategory",
        data: { name, departmentId: department.id, color: departmentColorHex(department.color), isActive: true },
      });
      setCategoryDrafts((current) => ({ ...current, [department.id]: "" }));
      await reload();
    } catch (caught) {
      window.alert(mutationMessage(caught instanceof Error ? caught.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function createGlobalCategory() {
    if (!business?.id || !catName.trim() || !catDept) return;
    const department = data.departments.find((item) => item.id === catDept);
    setBusy(true);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: "createDepartmentCategory",
        data: { name: catName.trim(), departmentId: catDept, color: departmentColorHex(department?.color), isActive: true },
      });
      setOpenCategory(false);
      setCatName("");
      setCatDept("");
      await reload();
    } catch (caught) {
      window.alert(mutationMessage(caught instanceof Error ? caught.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function requestDeleteCategory(categoryId: string, name: string) {
    if (!business?.id) return;
    const count = data.projects.filter((item) => item.categoryId === categoryId).length;
    if (count > 0) {
      setReassign({ id: categoryId, name, count, moveTo: "" });
      return;
    }
    setBusy(true);
    try {
      await mutateBusiness({ businessId: business.id, action: "deleteDepartmentCategory", id: categoryId });
      await reload();
    } catch (caught) {
      const error = caught as Error & { count?: number };
      if (error.message === "CATEGORY_IN_USE") {
        setReassign({ id: categoryId, name, count: error.count ?? count, moveTo: "" });
      } else {
        window.alert(mutationMessage(error.message));
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmReassign() {
    if (!business?.id || !reassign?.moveTo) return;
    setBusy(true);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: "deleteDepartmentCategory",
        id: reassign.id,
        data: { moveToCategoryId: reassign.moveTo },
      });
      setReassign(null);
      await reload();
    } catch (caught) {
      window.alert(mutationMessage(caught instanceof Error ? caught.message : ""));
    } finally {
      setBusy(false);
    }
  }

  function openEdit(employee: Employee) {
    const member = data.members.find((item) => item.employeeId === employee.id || item.userId === employee.uid);
    setError("");
    setEmployeeDraft({
      id: employee.id,
      displayName: employee.displayName,
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      departmentId: employee.departmentId ?? "",
      role: member?.role ?? employee.role ?? "EMPLOYEE",
      status: employee.status,
      password: "",
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader title="הגדרות ושליטה" subtitle="ניהול צוות ומחלקות ממקום אחד. התפקיד של העובד קובע את ההרשאות." />
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`min-h-11 rounded-xl px-3 py-2 text-sm ${tab === item ? "bg-[var(--brand-primary)] text-white" : "bg-white text-slate-600"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "צוות" && canTeam ? (
        <SectionCard title="צוות" action={<PrimaryButton onClick={() => { setError(""); setShowPassword(false); setEmployeeDraft({ ...EMPTY_EMPLOYEE }); }}>+ הוסף עובד</PrimaryButton>}>
          {employees.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      {["שם", "אימייל", "טלפון", "מחלקה", "תפקיד", "סטטוס", "פעולות"].map((item) => <th key={item} className="py-2 text-start">{item}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => {
                      const member = data.members.find((item) => item.employeeId === employee.id || item.userId === employee.uid);
                      const role = member?.role ?? employee.role ?? "EMPLOYEE";
                      return (
                        <tr key={employee.id} className="border-t border-slate-100">
                          <td className="py-2">{employee.displayName}</td>
                          <td className="py-2">{employee.email}</td>
                          <td className="py-2">{employee.phone || "—"}</td>
                          <td className="py-2">{departmentName(data.departments, employee.departmentId)}</td>
                          <td className="py-2">{role}</td>
                          <td className="py-2"><StatusBadge value={employee.status} label={labelOf(employee.status)} /></td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              <GhostButton onClick={() => openEdit(employee)}>עריכה</GhostButton>
                              <GhostButton onClick={() => {
                                if (!business?.id) return;
                                void mutateBusiness({
                                  businessId: business.id,
                                  action: "updateEmployee",
                                  id: employee.id,
                                  data: {
                                    displayName: employee.displayName,
                                    status: employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                                    role,
                                  },
                                }).then(reload);
                              }}>{employee.status === "ACTIVE" ? "השבתה" : "הפעלה"}</GhostButton>
                              <GhostButton onClick={() => { setError(""); setShowResetPassword(false); setPasswordDraft({ id: employee.id, name: employee.displayName, password: "" }); }}>
                                איפוס סיסמה
                              </GhostButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 md:hidden">
                {employees.map((employee) => {
                  const member = data.members.find((item) => item.employeeId === employee.id || item.userId === employee.uid);
                  const role = member?.role ?? employee.role ?? "EMPLOYEE";
                  return (
                    <article key={employee.id} className="rounded-2xl border border-slate-200 p-3">
                      <p className="font-medium">{employee.displayName}</p>
                      <p className="text-xs text-slate-500">{employee.email}</p>
                      <p className="mt-1 text-xs text-slate-500">{departmentName(data.departments, employee.departmentId)} · {role}</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        <GhostButton onClick={() => openEdit(employee)}>עריכה</GhostButton>
                        <GhostButton onClick={() => {
                          if (!business?.id) return;
                          void mutateBusiness({
                            businessId: business.id,
                            action: "updateEmployee",
                            id: employee.id,
                            data: { displayName: employee.displayName, status: employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", role },
                          }).then(reload);
                        }}>{employee.status === "ACTIVE" ? "השבתה" : "הפעלה"}</GhostButton>
                        <GhostButton onClick={() => { setError(""); setShowResetPassword(false); setPasswordDraft({ id: employee.id, name: employee.displayName, password: "" }); }}>
                          איפוס סיסמה
                        </GhostButton>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : <EmptyState icon={Users} title="אין עובדים להצגה" />}
        </SectionCard>
      ) : null}

      {tab === "מחלקות" && canDept ? (
        <SectionCard title="מחלקות" action={<PrimaryButton onClick={() => setOpenDept(true)}>+ מחלקה</PrimaryButton>}>
          {data.departments.length ? data.departments.map((item) => {
            const categories = categoriesForDepartment(data.departmentCategories, item.id, { includeInactive: true });
            return (
              <div key={item.id} className="border-t border-slate-100 py-4 first:border-0">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: departmentColorHex(item.color) }} />
                      <p className="font-medium">{item.name}</p>
                    </div>
                    <p className="text-xs text-slate-500">{item.isActive ? "פעילה" : "מושבתת"} · {categories.length} קטגוריות</p>
                    <div className="mt-2">
                      <ColorPicker
                        value={item.color}
                        onChange={(color) => {
                          if (!business?.id) return;
                          void mutateBusiness({
                            businessId: business.id,
                            action: "updateDepartment",
                            id: item.id,
                            data: { name: item.name, isActive: item.isActive, color },
                          }).then(reload);
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <GhostButton onClick={() => {
                      const next = window.prompt("שם מחלקה", item.name);
                      if (!next || !business?.id) return;
                      void mutateBusiness({ businessId: business.id, action: "updateDepartment", id: item.id, data: { name: next, isActive: item.isActive, color: item.color } })
                        .then(reload)
                        .catch((caught: Error) => window.alert(mutationMessage(caught.message)));
                    }}>עריכה</GhostButton>
                    <GhostButton onClick={() => {
                      if (!business?.id) return;
                      void mutateBusiness({ businessId: business.id, action: "updateDepartment", id: item.id, data: { name: item.name, isActive: !item.isActive, color: item.color } }).then(reload);
                    }}>{item.isActive ? "השבתה" : "הפעלה"}</GhostButton>
                    <GhostButton onClick={() => {
                      if (!business?.id) return;
                      void mutateBusiness({ businessId: business.id, action: "deleteDepartment", id: item.id })
                        .then(reload)
                        .catch((caught: Error) => window.alert(mutationMessage(caught.message)));
                    }}>מחיקה</GhostButton>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-500">קטגוריות / תתי-מחלקות</p>
                  <div className="grid gap-2">
                    {categories.map((category) => (
                      <div key={category.id} className="flex flex-col gap-2 rounded-xl bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm">{category.name}</p>
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge value={category.isActive ? "ACTIVE" : "INACTIVE"} label={category.isActive ? "פעיל" : "לא פעיל"} />
                          <GhostButton onClick={() => {
                            const next = window.prompt("שם קטגוריה", category.name);
                            if (!next || !business?.id) return;
                            void mutateBusiness({
                              businessId: business.id,
                              action: "updateDepartmentCategory",
                              id: category.id,
                              data: { name: next, departmentId: item.id, isActive: category.isActive, color: category.color },
                            }).then(reload).catch((caught: Error) => window.alert(mutationMessage(caught.message)));
                          }}>עריכה</GhostButton>
                          <GhostButton onClick={() => {
                            if (!business?.id) return;
                            void mutateBusiness({
                              businessId: business.id,
                              action: "updateDepartmentCategory",
                              id: category.id,
                              data: { name: category.name, departmentId: item.id, isActive: !category.isActive, color: category.color },
                            }).then(reload);
                          }}>{category.isActive ? "השבתה" : "הפעלה"}</GhostButton>
                          <GhostButton onClick={() => void requestDeleteCategory(category.id, category.name)}>מחיקה</GhostButton>
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        className={inputClass}
                        placeholder="שם קטגוריה"
                        value={categoryDrafts[item.id] ?? ""}
                        onChange={(event) => setCategoryDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                      <PrimaryButton disabled={busy} onClick={() => void addCategory(item)}>+ הוסף קטגוריה</PrimaryButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          }) : <EmptyState icon={Building2} title="אין מחלקות מוגדרות" />}
        </SectionCard>
      ) : null}

      {tab === "קטגוריות" && canDept ? (
        <SectionCard title="קטגוריות" action={<PrimaryButton onClick={() => setOpenCategory(true)}>+ הוסף קטגוריה</PrimaryButton>}>
          {data.departmentCategories.length ? (
            <div className="grid gap-2">
              {data.departmentCategories
                .slice()
                .sort((left, right) => left.name.localeCompare(right.name, "he"))
                .map((category) => {
                  const used = data.projects.filter((item) => item.categoryId === category.id).length;
                  return (
                    <div key={category.id} className="flex flex-col gap-2 rounded-2xl border border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <p className="text-xs text-slate-500">
                          {departmentName(data.departments, category.departmentId)} · {used} פרויקטים · {category.isActive ? "פעיל" : "לא פעיל"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <GhostButton onClick={() => {
                          const next = window.prompt("שם קטגוריה", category.name);
                          if (!next || !business?.id) return;
                          void mutateBusiness({
                            businessId: business.id,
                            action: "updateDepartmentCategory",
                            id: category.id,
                            data: { name: next, departmentId: category.departmentId, isActive: category.isActive, color: category.color },
                          }).then(reload).catch((caught: Error) => window.alert(mutationMessage(caught.message)));
                        }}>עריכה</GhostButton>
                        <GhostButton onClick={() => {
                          if (!business?.id) return;
                          void mutateBusiness({
                            businessId: business.id,
                            action: "updateDepartmentCategory",
                            id: category.id,
                            data: { name: category.name, departmentId: category.departmentId, isActive: !category.isActive, color: category.color },
                          }).then(reload);
                        }}>{category.isActive ? "השבתה" : "הפעלה"}</GhostButton>
                        <GhostButton onClick={() => void requestDeleteCategory(category.id, category.name)}>מחיקה</GhostButton>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : <EmptyState icon={Tags} title="אין קטגוריות מוגדרות" />}
        </SectionCard>
      ) : null}

      {tab === "הגדרות העסק" && canBiz && business ? (
        <SectionCard title="הגדרות העסק">
          <div className="max-w-xl">
            <BusinessSettingsForm
              business={business}
              settings={data.settings}
              onSaved={async () => {
                await Promise.all([reload(), refresh()]);
              }}
            />
          </div>
        </SectionCard>
      ) : null}

      {employeeDraft ? (
        <Modal title={employeeDraft.id ? "עריכת עובד" : "הוספת עובד"} onClose={() => setEmployeeDraft(null)}>
          <div className="grid gap-3">
            <Field label="שם *"><input className={inputClass} value={employeeDraft.displayName} onChange={(event) => setEmployeeDraft({ ...employeeDraft, displayName: event.target.value })} /></Field>
            <Field label="אימייל *">
              <input className={inputClass} type="email" value={employeeDraft.email} disabled={Boolean(employeeDraft.id)} onChange={(event) => setEmployeeDraft({ ...employeeDraft, email: event.target.value })} />
            </Field>
            {!employeeDraft.id ? (
              <Field label="סיסמה *">
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    type={showPassword ? "text" : "password"}
                    value={employeeDraft.password}
                    autoComplete="new-password"
                    onChange={(event) => setEmployeeDraft({ ...employeeDraft, password: event.target.value })}
                  />
                  <GhostButton onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? <span className="inline-flex items-center gap-1"><EyeOff className="h-4 w-4" /> הסתר</span> : <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> הצג</span>}
                  </GhostButton>
                </div>
              </Field>
            ) : null}
            <Field label="טלפון"><input className={inputClass} value={employeeDraft.phone} onChange={(event) => setEmployeeDraft({ ...employeeDraft, phone: event.target.value })} /></Field>
            <Field label="מחלקה">
              <select className={inputClass} value={employeeDraft.departmentId} onChange={(event) => setEmployeeDraft({ ...employeeDraft, departmentId: event.target.value })}>
                <option value="">ללא</option>
                {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="תפקיד">
              <select className={inputClass} value={employeeDraft.role} onChange={(event) => setEmployeeDraft({ ...employeeDraft, role: event.target.value })}>
                {BUSINESS_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="סטטוס">
              <select className={inputClass} value={employeeDraft.status} onChange={(event) => setEmployeeDraft({ ...employeeDraft, status: event.target.value as "ACTIVE" | "INACTIVE" })}>
                <option value="ACTIVE">פעיל</option>
                <option value="INACTIVE">לא פעיל</option>
              </select>
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setEmployeeDraft(null)}>ביטול</GhostButton>
              <PrimaryButton disabled={busy} onClick={() => void saveEmployee()}>שמירה</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {passwordDraft ? (
        <Modal title={`איפוס סיסמה · ${passwordDraft.name}`} onClose={() => setPasswordDraft(null)}>
          <div className="grid gap-3">
            <Field label="סיסמה חדשה *">
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  type={showResetPassword ? "text" : "password"}
                  value={passwordDraft.password}
                  autoComplete="new-password"
                  onChange={(event) => setPasswordDraft({ ...passwordDraft, password: event.target.value })}
                />
                <GhostButton onClick={() => setShowResetPassword((value) => !value)}>
                  {showResetPassword ? <span className="inline-flex items-center gap-1"><EyeOff className="h-4 w-4" /> הסתר</span> : <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> הצג</span>}
                </GhostButton>
              </div>
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setPasswordDraft(null)}>ביטול</GhostButton>
              <PrimaryButton disabled={busy} onClick={() => void savePassword()}>שמירה</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {openDept ? (
        <Modal title="מחלקה חדשה" onClose={() => setOpenDept(false)}>
          <div className="grid gap-3">
            <Field label="שם"><input className={inputClass} value={deptName} onChange={(event) => setDeptName(event.target.value)} /></Field>
            <Field label="צבע מחלקה">
              <ColorPicker value={deptColor} onChange={setDeptColor} />
            </Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setOpenDept(false)}>ביטול</GhostButton>
              <PrimaryButton disabled={busy} onClick={() => void createDepartment()}>שמירה</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {openCategory ? (
        <Modal title="קטגוריה חדשה" onClose={() => setOpenCategory(false)}>
          <div className="grid gap-3">
            <Field label="שם *"><input className={inputClass} value={catName} onChange={(event) => setCatName(event.target.value)} /></Field>
            <Field label="מחלקה *">
              <select className={inputClass} value={catDept} onChange={(event) => setCatDept(event.target.value)}>
                <option value="">בחירת מחלקה</option>
                {data.departments.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setOpenCategory(false)}>ביטול</GhostButton>
              <PrimaryButton disabled={busy || !catName.trim() || !catDept} onClick={() => void createGlobalCategory()}>שמירה</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {reassign ? (
        <Modal title="מחיקת קטגוריה" onClose={() => setReassign(null)}>
          <div className="grid gap-3">
            <p className="text-sm text-slate-700">קטגוריה זו משויכת ל-{reassign.count} פרויקטים</p>
            <Field label="העבר פרויקטים לקטגוריה אחרת">
              <select className={inputClass} value={reassign.moveTo} onChange={(event) => setReassign({ ...reassign, moveTo: event.target.value })}>
                <option value="">בחר קטגוריה</option>
                {data.departmentCategories.filter((item) => item.id !== reassign.id && item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setReassign(null)}>ביטול</GhostButton>
              <PrimaryButton disabled={busy || !reassign.moveTo} onClick={() => void confirmReassign()}>העבר פרויקטים לקטגוריה אחרת</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
