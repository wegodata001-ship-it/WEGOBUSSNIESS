"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Users, Building2, Tags } from "lucide-react";
import { BusinessSettingsForm } from "@/components/admin/business-settings-form";
import { NotificationSettingsPanel } from "@/components/admin/notification-settings";
import { TaskStatusesSettings } from "@/components/admin/task-statuses-settings";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { ColorPicker } from "@/components/admin/form-chips";
import { useAuth } from "@/components/providers/auth-provider";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
import { mutateBusiness } from "@/lib/admin/api";
import { categoriesForDepartment, departmentColorHex } from "@/lib/admin/department-categories";
import { departmentName, useBusinessCatalog } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import type { CalendarColor } from "@/lib/admin/palette";
import type { MessageKey } from "@/lib/i18n/types";
import { BUSINESS_ROLES } from "@/types/roles";
import type { Department } from "@/types/department";
import type { Employee } from "@/types/employee";

type SettingsTab = "team" | "departments" | "categories" | "statuses" | "mail" | "business";

const TABS: Array<{ id: SettingsTab; key: MessageKey }> = [
  { id: "team", key: "nav.team" },
  { id: "departments", key: "nav.departments" },
  { id: "categories", key: "settings.categories" },
  { id: "statuses", key: "settings.statuses" },
  { id: "mail", key: "settings.mailTab" },
  { id: "business", key: "settings.businessTab" },
];

function mutationMessage(code: string, t: (key: MessageKey) => string) {
  const map: Record<string, MessageKey> = {
    PASSWORD_REQUIRED: "settings.passwordRequired",
    WEAK_PASSWORD: "settings.weakPassword",
    AUTH_EMAIL_EXISTS: "settings.authEmailExists",
    DUPLICATE_EMPLOYEE: "settings.duplicateEmployee",
    AUTH_CREATE_FAILED: "settings.authCreateFailed",
    INVALID_EMAIL: "settings.invalidEmail",
    FORBIDDEN: "settings.forbidden",
    NAME_REQUIRED: "settings.employeeNameRequired",
    EMAIL_REQUIRED: "settings.emailRequired",
    DUPLICATE_DEPARTMENT: "settings.duplicateDepartment",
    DUPLICATE_CATEGORY: "settings.duplicateCategory",
    DEPARTMENT_IN_USE: "settings.departmentInUse",
    CATEGORY_IN_USE: "settings.categoryInUse",
  };
  return t(map[code] ?? "common.failed");
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
  const { t, locale } = useI18n();
  const { business, permissions, membership } = useBusinessContext();
  const { refresh } = useAuth();
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const searchParams = useSearchParams();
  const owner = membership?.role === "BUSINESS_OWNER";
  const canTeam = permissions.includes("employees.manage") || owner;
  const canDept = permissions.includes("departments.manage") || owner;
  const canBiz = permissions.includes("settings.manage") || owner;
  const canStatuses = canBiz || canDept;
  const tabs = TABS.filter((tab) =>
    (tab.id !== "business" || canBiz)
    && (tab.id !== "statuses" || canStatuses)
    && (tab.id !== "mail" || canBiz)
  );
  const [mailBusy, setMailBusy] = useState(false);
  const [mailStatus, setMailStatus] = useState<{
    senderEmail?: string;
    adminEmail?: string;
    provider?: string;
    reason?: string;
    wegoSenderVerified?: boolean;
  } | null>(null);
  const [mailResult, setMailResult] = useState<{
    ok: boolean;
    message: string;
    reason?: string;
    to?: string;
    messageId?: string;
  } | null>(null);

  const [tab, setTab] = useState<SettingsTab>("team");
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<{ id: string; name: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [openDept, setOpenDept] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptColor, setDeptColor] = useState<CalendarColor>("BLUE");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [categoryColorDrafts, setCategoryColorDrafts] = useState<Record<string, string>>({});
  const [openCategory, setOpenCategory] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDept, setCatDept] = useState("");
  const [catColor, setCatColor] = useState("#64748b");
  const [reassign, setReassign] = useState<{ id: string; name: string; count: number; moveTo: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchParams.get("new") === "employee" && canTeam) {
      setTab("team");
      setEmployeeDraft({ ...EMPTY_EMPLOYEE });
    }
  }, [canTeam, searchParams]);

  useEffect(() => {
    if (tab !== "mail" || !business?.id || !canBiz) return;
    void fetch(`/api/business/mail/test?businessId=${encodeURIComponent(business.id)}`, { credentials: "include" })
      .then((response) => response.json())
      .then((payload: {
        config?: { senderEmail?: string; adminEmail?: string; provider?: string };
        wegoSenderVerified?: boolean;
        connection?: { reason?: string };
      }) => {
        setMailStatus({
          senderEmail: payload.config?.senderEmail,
          adminEmail: payload.config?.adminEmail,
          provider: payload.config?.provider,
          reason: payload.connection?.reason,
          wegoSenderVerified: payload.wegoSenderVerified,
        });
      })
      .catch(() => undefined);
  }, [tab, business?.id, canBiz]);

  const employees = useMemo(() => data.employees, [data.employees]);

  if (loading) return <Spinner label={t("common.loading")} />;
  if (!canTeam && !canDept && !canBiz) {
    return <EmptyState icon={Users} title={t("empty.noAccess")} />;
  }

  async function saveEmployee() {
    if (!business?.id || !employeeDraft) return;
    if (!employeeDraft.displayName.trim() || !employeeDraft.email.trim()) {
      setError(mutationMessage(!employeeDraft.displayName.trim() ? "NAME_REQUIRED" : "EMAIL_REQUIRED", t));
      return;
    }
    if (!employeeDraft.id && !employeeDraft.password) {
      setError(mutationMessage("PASSWORD_REQUIRED", t));
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
      setError(mutationMessage(caught instanceof Error ? caught.message : "", t));
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
      setError(mutationMessage(caught instanceof Error ? caught.message : "", t));
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
      window.alert(mutationMessage(caught instanceof Error ? caught.message : "", t));
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
        data: { name, departmentId: department.id, color: categoryColorDrafts[department.id] || departmentColorHex(department.color), isActive: true },
      });
      setCategoryDrafts((current) => ({ ...current, [department.id]: "" }));
      await reload();
    } catch (caught) {
      window.alert(mutationMessage(caught instanceof Error ? caught.message : "", t));
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
        data: { name: catName.trim(), departmentId: catDept, color: catColor || departmentColorHex(department?.color), isActive: true },
      });
      setOpenCategory(false);
      setCatName("");
      setCatDept("");
      setCatColor("#64748b");
      await reload();
    } catch (caught) {
      window.alert(mutationMessage(caught instanceof Error ? caught.message : "", t));
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
        window.alert(mutationMessage(error.message, t));
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
      window.alert(mutationMessage(caught instanceof Error ? caught.message : "", t));
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

  function roleLabel(role: string) {
    return t(`roles.${role}` as MessageKey);
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("nav.settings")} subtitle={t("settings.subtitle")} />
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-h-11 rounded-xl px-3 py-2 text-sm ${tab === item.id ? "bg-[var(--brand-primary)] text-white" : "bg-white text-slate-600"}`}
          >
            {t(item.key)}
          </button>
        ))}
      </div>

      {tab === "team" && canTeam ? (
        <SectionCard title={t("nav.team")} action={<PrimaryButton onClick={() => { setError(""); setShowPassword(false); setEmployeeDraft({ ...EMPTY_EMPLOYEE }); }}>{t("settings.addEmployee")}</PrimaryButton>}>
          {employees.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      {(["common.name", "common.email", "common.phone", "common.department", "common.role", "common.status", "common.actions"] as const).map((item) => <th key={item} className="py-2 text-start">{t(item)}</th>)}
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
                          <td className="py-2">{roleLabel(role)}</td>
                          <td className="py-2"><StatusBadge value={employee.status} label={labelOf(employee.status)} /></td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              <GhostButton onClick={() => openEdit(employee)}>{t("common.edit")}</GhostButton>
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
                              }}>{employee.status === "ACTIVE" ? t("common.deactivate") : t("common.activate")}</GhostButton>
                              <GhostButton onClick={() => { setError(""); setShowResetPassword(false); setPasswordDraft({ id: employee.id, name: employee.displayName, password: "" }); }}>
                                {t("settings.resetPassword")}
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
                      <p className="mt-1 text-xs text-slate-500">{departmentName(data.departments, employee.departmentId)} · {roleLabel(role)}</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        <GhostButton onClick={() => openEdit(employee)}>{t("common.edit")}</GhostButton>
                        <GhostButton onClick={() => {
                          if (!business?.id) return;
                          void mutateBusiness({
                            businessId: business.id,
                            action: "updateEmployee",
                            id: employee.id,
                            data: { displayName: employee.displayName, status: employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", role },
                          }).then(reload);
                        }}>{employee.status === "ACTIVE" ? t("common.deactivate") : t("common.activate")}</GhostButton>
                        <GhostButton onClick={() => { setError(""); setShowResetPassword(false); setPasswordDraft({ id: employee.id, name: employee.displayName, password: "" }); }}>
                          {t("settings.resetPassword")}
                        </GhostButton>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : <EmptyState icon={Users} title={t("empty.employees")} />}
        </SectionCard>
      ) : null}

      {tab === "departments" && canDept ? (
        <SectionCard title={t("nav.departments")} action={<PrimaryButton onClick={() => setOpenDept(true)}>{t("settings.addDepartment")}</PrimaryButton>}>
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
                    <p className="text-xs text-slate-500">{item.isActive ? t("common.active") : t("common.inactive")} · {t("settings.categoryCount", { count: String(categories.length) })}</p>
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
                      const next = window.prompt(t("settings.departmentNamePrompt"), item.name);
                      if (!next || !business?.id) return;
                      void mutateBusiness({ businessId: business.id, action: "updateDepartment", id: item.id, data: { name: next, isActive: item.isActive, color: item.color } })
                        .then(reload)
                        .catch((caught: Error) => window.alert(mutationMessage(caught.message, t)));
                    }}>{t("common.edit")}</GhostButton>
                    <GhostButton onClick={() => {
                      if (!business?.id) return;
                      void mutateBusiness({ businessId: business.id, action: "updateDepartment", id: item.id, data: { name: item.name, isActive: !item.isActive, color: item.color } }).then(reload);
                    }}>{item.isActive ? t("common.deactivate") : t("common.activate")}</GhostButton>
                    <GhostButton onClick={() => {
                      if (!business?.id) return;
                      void mutateBusiness({ businessId: business.id, action: "deleteDepartment", id: item.id })
                        .then(reload)
                        .catch((caught: Error) => window.alert(mutationMessage(caught.message, t)));
                    }}>{t("common.delete")}</GhostButton>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-500">{t("settings.subcategories")}</p>
                  <div className="grid gap-2">
                    {categories.map((category) => (
                      <div key={category.id} className="flex flex-col gap-2 rounded-xl bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            aria-label={t("common.color")}
                            className="h-8 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0"
                            value={category.color?.startsWith("#") ? category.color : "#64748b"}
                            onChange={(event) => {
                              if (!business?.id) return;
                              void mutateBusiness({
                                businessId: business.id,
                                action: "updateDepartmentCategory",
                                id: category.id,
                                data: { name: category.name, departmentId: item.id, isActive: category.isActive, color: event.target.value },
                              }).then(reload);
                            }}
                          />
                          <p className="text-sm">{category.name}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge value={category.isActive ? "ACTIVE" : "INACTIVE"} label={category.isActive ? t("common.active") : t("common.inactive")} />
                          <GhostButton onClick={() => {
                            const next = window.prompt(t("settings.categoryNamePrompt"), category.name);
                            if (!next || !business?.id) return;
                            void mutateBusiness({
                              businessId: business.id,
                              action: "updateDepartmentCategory",
                              id: category.id,
                              data: { name: next, departmentId: item.id, isActive: category.isActive, color: category.color },
                            }).then(reload).catch((caught: Error) => window.alert(mutationMessage(caught.message, t)));
                          }}>{t("common.edit")}</GhostButton>
                          <GhostButton onClick={() => {
                            if (!business?.id) return;
                            void mutateBusiness({
                              businessId: business.id,
                              action: "updateDepartmentCategory",
                              id: category.id,
                              data: { name: category.name, departmentId: item.id, isActive: !category.isActive, color: category.color },
                            }).then(reload);
                          }}>{category.isActive ? t("common.deactivate") : t("common.activate")}</GhostButton>
                          <GhostButton onClick={() => void requestDeleteCategory(category.id, category.name)}>{t("common.delete")}</GhostButton>
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        className={inputClass}
                        placeholder={t("settings.categoryNamePrompt")}
                        value={categoryDrafts[item.id] ?? ""}
                        onChange={(event) => setCategoryDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                      <input
                        type="color"
                        aria-label={t("common.color")}
                        className="h-11 w-11 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                        value={categoryColorDrafts[item.id] || departmentColorHex(item.color)}
                        onChange={(event) => setCategoryColorDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                      <PrimaryButton disabled={busy} onClick={() => void addCategory(item)}>{t("settings.addCategory")}</PrimaryButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          }) : <EmptyState icon={Building2} title={t("empty.departments")} />}
        </SectionCard>
      ) : null}

      {tab === "categories" && canDept ? (
        <SectionCard title={t("settings.categories")} action={<PrimaryButton onClick={() => setOpenCategory(true)}>{t("settings.addCategory")}</PrimaryButton>}>
          {data.departmentCategories.length ? (
            <div className="grid gap-2">
              {data.departmentCategories
                .slice()
                .sort((left, right) => left.name.localeCompare(right.name, locale))
                .map((category) => {
                  const used = data.projects.filter((item) => item.categoryId === category.id).length;
                  return (
                    <div key={category.id} className="flex flex-col gap-2 rounded-2xl border border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-2">
                        <input
                          type="color"
                          aria-label={t("common.color")}
                          className="mt-0.5 h-8 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0"
                          value={category.color?.startsWith("#") ? category.color : "#64748b"}
                          onChange={(event) => {
                            if (!business?.id) return;
                            void mutateBusiness({
                              businessId: business.id,
                              action: "updateDepartmentCategory",
                              id: category.id,
                              data: { name: category.name, departmentId: category.departmentId, isActive: category.isActive, color: event.target.value },
                            }).then(reload);
                          }}
                        />
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <p className="text-xs text-slate-500">
                            {departmentName(data.departments, category.departmentId)} · {t("settings.projectCount", { count: String(used) })} · {category.isActive ? t("common.active") : t("common.inactive")}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <GhostButton onClick={() => {
                          const next = window.prompt(t("settings.categoryNamePrompt"), category.name);
                          if (!next || !business?.id) return;
                          void mutateBusiness({
                            businessId: business.id,
                            action: "updateDepartmentCategory",
                            id: category.id,
                            data: { name: next, departmentId: category.departmentId, isActive: category.isActive, color: category.color },
                          }).then(reload).catch((caught: Error) => window.alert(mutationMessage(caught.message, t)));
                        }}>{t("common.edit")}</GhostButton>
                        <GhostButton onClick={() => {
                          if (!business?.id) return;
                          void mutateBusiness({
                            businessId: business.id,
                            action: "updateDepartmentCategory",
                            id: category.id,
                            data: { name: category.name, departmentId: category.departmentId, isActive: !category.isActive, color: category.color },
                          }).then(reload);
                        }}>{category.isActive ? t("common.deactivate") : t("common.activate")}</GhostButton>
                        <GhostButton onClick={() => void requestDeleteCategory(category.id, category.name)}>{t("common.delete")}</GhostButton>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : <EmptyState icon={Tags} title={t("empty.categories")} />}
        </SectionCard>
      ) : null}

      {tab === "statuses" && canStatuses && business?.id ? (
        <SectionCard title={t("settings.statuses")}>
          <TaskStatusesSettings
            statuses={data.taskStatuses}
            busy={busy}
            onSave={async (input) => {
              setBusy(true);
              setError("");
              const response = await fetch("/api/business/task-statuses", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessId: business.id, id: input.id, data: input }),
              });
              const payload = await response.json().catch(() => ({})) as { error?: string };
              setBusy(false);
              if (!response.ok || payload.error) {
                setError(mutationMessage(payload.error || "FORBIDDEN", t));
                return;
              }
              await reload({ silent: true });
            }}
            onReorder={async (ids) => {
              await fetch("/api/business/task-statuses", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessId: business.id, action: "reorder", ids }),
              });
              await reload({ silent: true });
            }}
          />
        </SectionCard>
      ) : null}

      {tab === "mail" && canBiz && business?.id ? (
        <SectionCard title={t("settings.mailTab")}>
          <p className="mb-4 text-sm text-slate-600">{t("settings.mailSubtitle")}</p>
          <div className="mb-4 space-y-1 text-sm text-slate-700">
            <p>{t("settings.mailProvider")}: Brevo</p>
            <p>{t("settings.mailSender")}: {mailStatus?.senderEmail || "—"}</p>
            <p>{t("settings.mailAdmin")}: {mailStatus?.adminEmail || "wego.biz24@gmail.com"}</p>
            <p>{t("settings.mailRecipient")}: abulieltasneem23@gmail.com</p>
            {mailStatus?.reason === "IP_ALLOWLIST" ? (
              <p className="text-rose-700">{t("settings.mailIpBlocked")}</p>
            ) : mailStatus?.reason === "WEGO_EMAIL_SENDER_NOT_CONFIGURED" || mailStatus?.reason === "SENDER_NOT_VERIFIED" ? (
              <p className="text-rose-700">{t("settings.mailSenderMissing")}</p>
            ) : mailStatus?.reason === "AUTH_FAILED" ? (
              <p className="text-rose-700">{t("settings.mailAuthFailed")}</p>
            ) : mailStatus?.reason === "MAIL_NOT_CONFIGURED" ? (
              <p className="text-rose-700">{t("settings.mailNotConfigured")}</p>
            ) : null}
          </div>
          <PrimaryButton
            disabled={mailBusy}
            onClick={() => {
              void (async () => {
                setMailBusy(true);
                setMailResult(null);
                if (!mailStatus) {
                  const statusRes = await fetch(`/api/business/mail/test?businessId=${encodeURIComponent(business.id)}`, { credentials: "include" });
                  const statusPayload = await statusRes.json().catch(() => ({})) as {
                    config?: { senderEmail?: string; adminEmail?: string; provider?: string };
                    wegoSenderVerified?: boolean;
                    connection?: { reason?: string };
                  };
                  setMailStatus({
                    senderEmail: statusPayload.config?.senderEmail,
                    adminEmail: statusPayload.config?.adminEmail,
                    provider: statusPayload.config?.provider,
                    reason: statusPayload.connection?.reason,
                    wegoSenderVerified: statusPayload.wegoSenderVerified,
                  });
                }
                const response = await fetch("/api/business/mail/test", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ businessId: business.id }),
                });
                const payload = await response.json().catch(() => ({})) as {
                  ok?: boolean;
                  messageId?: string;
                  to?: string;
                  reason?: string;
                  error?: string;
                };
                setMailBusy(false);
                const reason = payload.reason || payload.error || "";
                const reasonText = reason === "IP_ALLOWLIST" ? t("settings.mailIpBlocked")
                  : reason === "SENDER_NOT_VERIFIED" || reason === "WEGO_EMAIL_SENDER_NOT_CONFIGURED" ? t("settings.mailSenderMissing")
                    : reason === "AUTH_FAILED" ? t("settings.mailAuthFailed")
                      : reason === "MAIL_NOT_CONFIGURED" ? t("settings.mailNotConfigured")
                        : t("settings.testMailFailed");
                setMailResult({
                  ok: Boolean(response.ok && payload.ok && payload.messageId),
                  message: response.ok && payload.ok && payload.messageId ? t("settings.testMailSent") : t("settings.testMailFailed"),
                  reason: reasonText,
                  to: payload.to,
                  messageId: payload.messageId,
                });
              })();
            }}
          >
            {t("settings.sendTestMail")}
          </PrimaryButton>
          {mailResult ? (
            <div className={`mt-4 space-y-1 text-sm ${mailResult.ok ? "text-emerald-700" : "text-rose-700"}`}>
              <p className="font-medium">{mailResult.message}</p>
              {mailResult.to ? <p>{t("settings.mailRecipient")}: {mailResult.to}</p> : null}
              {mailResult.ok && mailResult.messageId ? <p>{t("settings.mailMessageId")}: {mailResult.messageId}</p> : null}
              {!mailResult.ok && mailResult.reason ? <p>{t("settings.mailReason")}: {mailResult.reason}</p> : null}
            </div>
          ) : null}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <NotificationSettingsPanel
              businessId={business.id}
              employees={employees.map((item) => ({ id: item.id, displayName: item.displayName, email: item.email }))}
            />
          </div>
        </SectionCard>
      ) : null}

      {tab === "business" && canBiz && business ? (
        <SectionCard title={t("settings.businessTab")}>
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
        <Modal title={employeeDraft.id ? t("settings.editEmployee") : t("settings.addEmployeeTitle")} onClose={() => setEmployeeDraft(null)}>
          <div className="grid gap-3">
            <Field label={`${t("common.name")} *`}><input className={inputClass} value={employeeDraft.displayName} onChange={(event) => setEmployeeDraft({ ...employeeDraft, displayName: event.target.value })} /></Field>
            <Field label={`${t("common.email")} *`}>
              <input className={inputClass} type="email" value={employeeDraft.email} disabled={Boolean(employeeDraft.id)} onChange={(event) => setEmployeeDraft({ ...employeeDraft, email: event.target.value })} />
            </Field>
            {!employeeDraft.id ? (
              <Field label={`${t("auth.password")} *`}>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    type={showPassword ? "text" : "password"}
                    value={employeeDraft.password}
                    autoComplete="new-password"
                    onChange={(event) => setEmployeeDraft({ ...employeeDraft, password: event.target.value })}
                  />
                  <GhostButton onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? <span className="inline-flex items-center gap-1"><EyeOff className="h-4 w-4" /> {t("auth.hidePassword")}</span> : <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> {t("auth.showPassword")}</span>}
                  </GhostButton>
                </div>
              </Field>
            ) : null}
            <Field label={t("common.phone")}><input className={inputClass} value={employeeDraft.phone} onChange={(event) => setEmployeeDraft({ ...employeeDraft, phone: event.target.value })} /></Field>
            <Field label={t("common.department")}>
              <select className={inputClass} value={employeeDraft.departmentId} onChange={(event) => setEmployeeDraft({ ...employeeDraft, departmentId: event.target.value })}>
                <option value="">{t("settings.none")}</option>
                {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label={t("common.role")}>
              <select className={inputClass} value={employeeDraft.role} onChange={(event) => setEmployeeDraft({ ...employeeDraft, role: event.target.value })}>
                {BUSINESS_ROLES.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
              </select>
            </Field>
            <Field label={t("common.status")}>
              <select className={inputClass} value={employeeDraft.status} onChange={(event) => setEmployeeDraft({ ...employeeDraft, status: event.target.value as "ACTIVE" | "INACTIVE" })}>
                <option value="ACTIVE">{t("status.ACTIVE")}</option>
                <option value="INACTIVE">{t("status.INACTIVE")}</option>
              </select>
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setEmployeeDraft(null)}>{t("common.cancel")}</GhostButton>
              <PrimaryButton disabled={busy} onClick={() => void saveEmployee()}>{t("common.save")}</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {passwordDraft ? (
        <Modal title={`${t("settings.resetPassword")} · ${passwordDraft.name}`} onClose={() => setPasswordDraft(null)}>
          <div className="grid gap-3">
            <Field label={t("settings.newPassword")}>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  type={showResetPassword ? "text" : "password"}
                  value={passwordDraft.password}
                  autoComplete="new-password"
                  onChange={(event) => setPasswordDraft({ ...passwordDraft, password: event.target.value })}
                />
                <GhostButton onClick={() => setShowResetPassword((value) => !value)}>
                  {showResetPassword ? <span className="inline-flex items-center gap-1"><EyeOff className="h-4 w-4" /> {t("auth.hidePassword")}</span> : <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> {t("auth.showPassword")}</span>}
                </GhostButton>
              </div>
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setPasswordDraft(null)}>{t("common.cancel")}</GhostButton>
              <PrimaryButton disabled={busy} onClick={() => void savePassword()}>{t("common.save")}</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {openDept ? (
        <Modal title={t("settings.newDepartment")} onClose={() => setOpenDept(false)}>
          <div className="grid gap-3">
            <Field label={t("common.name")}><input className={inputClass} value={deptName} onChange={(event) => setDeptName(event.target.value)} /></Field>
            <Field label={t("settings.departmentColor")}>
              <ColorPicker value={deptColor} onChange={setDeptColor} />
            </Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setOpenDept(false)}>{t("common.cancel")}</GhostButton>
              <PrimaryButton disabled={busy} onClick={() => void createDepartment()}>{t("common.save")}</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {openCategory ? (
        <Modal title={t("settings.newCategory")} onClose={() => setOpenCategory(false)}>
          <div className="grid gap-3">
            <Field label={`${t("common.name")} *`}><input className={inputClass} value={catName} onChange={(event) => setCatName(event.target.value)} /></Field>
            <Field label={`${t("common.department")} *`}>
              <select className={inputClass} value={catDept} onChange={(event) => setCatDept(event.target.value)}>
                <option value="">{t("settings.pickDepartment")}</option>
                {data.departments.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("common.color")}>
              <input
                type="color"
                aria-label={t("common.color")}
                className="h-11 w-16 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                value={catColor}
                onChange={(event) => setCatColor(event.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setOpenCategory(false)}>{t("common.cancel")}</GhostButton>
              <PrimaryButton disabled={busy || !catName.trim() || !catDept} onClick={() => void createGlobalCategory()}>{t("common.save")}</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {reassign ? (
        <Modal title={t("settings.deleteCategory")} onClose={() => setReassign(null)}>
          <div className="grid gap-3">
            <p className="text-sm text-slate-700">{t("settings.categoryLinked", { count: String(reassign.count) })}</p>
            <Field label={t("settings.moveProjects")}>
              <select className={inputClass} value={reassign.moveTo} onChange={(event) => setReassign({ ...reassign, moveTo: event.target.value })}>
                <option value="">{t("settings.pickCategory")}</option>
                {data.departmentCategories.filter((item) => item.id !== reassign.id && item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setReassign(null)}>{t("common.cancel")}</GhostButton>
              <PrimaryButton disabled={busy || !reassign.moveTo} onClick={() => void confirmReassign()}>{t("settings.moveProjects")}</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
