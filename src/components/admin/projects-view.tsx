"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FolderKanban, SlidersHorizontal, X } from "lucide-react";
import { Field, GhostButton, Modal, PageHeader, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { useBusinessContext } from "@/components/providers/business-context";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { mutateBusiness } from "@/lib/admin/api";
import { categoryStyles } from "@/lib/admin/category-color";
import {
  managedProjectCategories,
  projectMatchesCategoryFilter,
  resolveProjectCategory,
  UNCATEGORIZED_FILTER,
} from "@/lib/admin/department-categories";
import { employeeName, useBusinessCatalog } from "@/lib/admin/catalog";
import { computeProjectProgress, normalizeProjectProgress } from "@/lib/admin/project-progress";
import { labelOf } from "@/lib/admin/labels";
import { isOverdue, taskIsActive } from "@/lib/admin/time";
import { toTimestamp } from "@/lib/dates/timestamp";
import { todayInTimeZone } from "@/lib/dates/format";
import { PROJECT_STATUSES, type Project } from "@/types/department";

type SortId = "newest" | "oldest" | "name" | "progressHigh" | "progressLow" | "openTasks" | "overdueTasks";

type ProjectDraft = {
  id?: string;
  name: string;
  clientName: string;
  description: string;
  managerEmployeeId: string;
  departmentId: string;
  categoryId: string;
  location: string;
  projectNumber: string;
  startDate: string;
  dueDate: string;
  status: string;
  progress: number;
};

export function ProjectsView() {
  const { t, locale } = useI18n();
  const { business, permissions, membership } = useBusinessContext();
  const sortLocale = locale === "ar" ? "ar" : "he";
  const uncategorizedLabel = t("projects.uncategorized");
  const { data, loading, reload } = useBusinessCatalog(business?.id ?? null);
  const today = todayInTimeZone(business?.timezone);
  const canManage = permissions.includes("projects.manage") || membership?.role === "BUSINESS_OWNER";
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [client, setClient] = useState("");
  const [managerId, setManagerId] = useState("");
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [sort, setSort] = useState<SortId>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const draftCategories = useMemo(
    () => managedProjectCategories(data.departmentCategories, { includeId: draft?.categoryId }),
    [data.departmentCategories, draft?.categoryId],
  );

  const scoped = useMemo(() => data.projects.filter((item) => showArchive || item.isActive), [data.projects, showArchive]);

  const statsById = useMemo(() => {
    const map = new Map<string, { total: number; done: number; open: number; late: number; progress: number }>();
    for (const project of data.projects) {
      const tasks = data.tasks.filter((task) => task.projectId === project.id);
      const done = tasks.filter((task) => task.status === "DONE" || task.status === "COMPLETED").length;
      const late = tasks.filter((task) => isOverdue(task, today)).length;
      const open = tasks.filter(taskIsActive).length;
      map.set(project.id, {
        total: tasks.length,
        done,
        open,
        late,
        progress: computeProjectProgress(tasks),
      });
    }
    return map;
  }, [data.projects, data.tasks, today]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let uncategorized = 0;
    for (const project of scoped) {
      if (!project.categoryId) {
        uncategorized += 1;
        continue;
      }
      counts.set(project.categoryId, (counts.get(project.categoryId) ?? 0) + 1);
    }
    return { counts, uncategorized };
  }, [scoped]);

  const clients = useMemo(
    () => [...new Set(scoped.map((item) => item.clientName.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, sortLocale)),
    [scoped, sortLocale],
  );

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filtered = scoped.filter((project) => {
      if (!projectMatchesCategoryFilter(project, category)) return false;
      if (client && project.clientName !== client) return false;
      if (managerId && project.managerEmployeeId !== managerId) return false;
      if (status && (project.isActive ? project.status : "ARCHIVED") !== status) return false;
      if (departmentId && project.departmentId !== departmentId) return false;
      if (!search) return true;
      const manager = employeeName(data.employees, project.managerEmployeeId).toLowerCase();
      return [
        project.name,
        project.clientName,
        project.projectNumber ?? "",
        project.location ?? "",
        resolveProjectCategory(project, data.departmentCategories).name,
        manager,
      ].some((value) => value.toLowerCase().includes(search));
    });

    return filtered.sort((left, right) => {
      const leftStats = statsById.get(left.id);
      const rightStats = statsById.get(right.id);
      if (sort === "name") return left.name.localeCompare(right.name, sortLocale);
      if (sort === "progressHigh") return (rightStats?.progress ?? 0) - (leftStats?.progress ?? 0);
      if (sort === "progressLow") return (leftStats?.progress ?? 0) - (rightStats?.progress ?? 0);
      if (sort === "openTasks") return (rightStats?.open ?? 0) - (leftStats?.open ?? 0);
      if (sort === "overdueTasks") return (rightStats?.late ?? 0) - (leftStats?.late ?? 0);
      const leftTime = toTimestamp(left.createdAt) || toTimestamp(left.startDate);
      const rightTime = toTimestamp(right.createdAt) || toTimestamp(right.startDate);
      return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [category, client, data.departmentCategories, data.employees, departmentId, managerId, query, scoped, sort, sortLocale, statsById, status]);

  const activeFilters = [
    category ? {
      key: "category",
      label: category === UNCATEGORIZED_FILTER
        ? uncategorizedLabel
        : data.departmentCategories.find((item) => item.id === category)?.name ?? category,
      clear: () => setCategory(""),
    } : null,
    client ? { key: "client", label: client, clear: () => setClient("") } : null,
    managerId ? { key: "manager", label: employeeName(data.employees, managerId), clear: () => setManagerId("") } : null,
    status ? { key: "status", label: labelOf(status), clear: () => setStatus("") } : null,
    departmentId ? { key: "department", label: data.departments.find((item) => item.id === departmentId)?.name ?? "", clear: () => setDepartmentId("") } : null,
    query.trim() ? { key: "query", label: query.trim(), clear: () => setQuery("") } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  function clearFilters() {
    setQuery("");
    setCategory("");
    setClient("");
    setManagerId("");
    setStatus("");
    setDepartmentId("");
  }

  async function save() {
    if (!business?.id || !draft?.name.trim()) return;
    if (!draft.id && !draft.categoryId) return;
    setBusy(true);
    try {
      await mutateBusiness({
        businessId: business.id,
        action: draft.id ? "updateProject" : "createProject",
        id: draft.id,
        data: {
          name: draft.name,
          clientName: draft.clientName,
          description: draft.description,
          managerEmployeeId: draft.managerEmployeeId,
          departmentId: draft.departmentId,
          categoryId: draft.categoryId,
          location: draft.location,
          projectNumber: draft.projectNumber,
          startDate: draft.startDate,
          dueDate: draft.dueDate,
          status: draft.status,
          progress: normalizeProjectProgress(draft.progress),
          isActive: true,
        },
      });
      setDraft(null);
      await reload();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      window.alert(
        code === "DUPLICATE_PROJECT" ? t("projects.duplicate")
          : code === "CATEGORY_REQUIRED" ? t("projects.categoryNeeded")
            : code === "CATEGORY_NOT_IN_DEPARTMENT" ? t("projects.categoryDepartmentMismatch")
              : t("projects.saveFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, project: Project, extra?: Record<string, unknown>) {
    if (!business?.id) return;
    setBusy(true);
    try {
      await mutateBusiness({ businessId: business.id, action, id: project.id, data: extra });
      await reload();
    } catch (error) {
      window.alert(error instanceof Error && error.message === "PROJECT_IN_USE"
        ? t("projects.inUse")
        : t("common.failed"));
    } finally {
      setBusy(false);
    }
  }

  function openDraft(project?: Project) {
    setDraft({
      id: project?.id,
      name: project?.name ?? "",
      clientName: project?.clientName ?? "",
      description: project?.description ?? "",
      managerEmployeeId: project?.managerEmployeeId ?? "",
      departmentId: project?.departmentId ?? "",
      categoryId: project?.categoryId ?? "",
      location: project?.location ?? "",
      projectNumber: project?.projectNumber ?? "",
      startDate: project?.startDate ?? today,
      dueDate: project?.dueDate ?? today,
      status: project?.status ?? "ACTIVE",
      progress: normalizeProjectProgress(project?.progress),
    });
  }

  if (loading) return <Spinner label={t("common.loading")} />;

  const filterControls = (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Field label={t("common.client")}>
        <select className={inputClass} value={client} onChange={(event) => setClient(event.target.value)}>
          <option value="">{t("common.all")}</option>
          {clients.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </Field>
      <Field label={t("projects.responsible")}>
        <select className={inputClass} value={managerId} onChange={(event) => setManagerId(event.target.value)}>
          <option value="">{t("common.all")}</option>
          {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
        </select>
      </Field>
      <Field label={t("common.status")}>
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t("common.all")}</option>
          {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
          <option value="ARCHIVED">{t("common.archive")}</option>
        </select>
      </Field>
      {data.departments.length ? (
        <Field label={t("common.department")}>
          <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">{t("common.all")}</option>
            {data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
      ) : null}
      <Field label={t("projects.sortBy")}>
        <select className={inputClass} value={sort} onChange={(event) => setSort(event.target.value as SortId)}>
          <option value="newest">{t("projects.sortNewest")}</option>
          <option value="oldest">{t("projects.sortOldest")}</option>
          <option value="name">{t("projects.sortName")}</option>
          <option value="progressHigh">{t("projects.sortProgressHigh")}</option>
          <option value="progressLow">{t("projects.sortProgressLow")}</option>
          <option value="openTasks">{t("projects.sortOpenTasks")}</option>
          <option value="overdueTasks">{t("projects.sortOverdueTasks")}</option>
        </select>
      </Field>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageHeader
        title={t("projects.cardTitle")}
        subtitle={t("projects.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showArchive} onChange={(event) => setShowArchive(event.target.checked)} />
              {t("projects.showArchive")}
            </label>
            {canManage ? <PrimaryButton onClick={() => openDraft()}>{t("projects.new")}</PrimaryButton> : null}
          </div>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className={`${inputClass} min-h-11 sm:max-w-xs`}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label={t("projects.filterCategory")}
          >
            <option value="">{t("projects.allCategories")}</option>
            {managedProjectCategories(data.departmentCategories, { includeInactive: true }).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            <option value={UNCATEGORIZED_FILTER}>{uncategorizedLabel}</option>
          </select>
          <input
            className={`${inputClass} min-h-11 flex-1`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("projects.search")}
          />
          <GhostButton onClick={() => setFiltersOpen(true)}>
            <span className="inline-flex items-center gap-2 md:hidden"><SlidersHorizontal className="h-4 w-4" /> {t("projects.filter")}</span>
            <span className="hidden md:inline">{t("projects.filterAdvanced")}</span>
          </GhostButton>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`min-h-11 shrink-0 rounded-full border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${!category ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
          >
            {t("common.all")} {scoped.length}
          </button>
          {managedProjectCategories(data.departmentCategories, { includeInactive: true }).map((item) => {
            const styles = categoryStyles(item.color);
            const selected = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(selected ? "" : item.id)}
                className="min-h-11 shrink-0 rounded-full border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                style={{
                  background: selected ? styles.hex : styles.badge,
                  color: selected ? "#fff" : styles.badgeText,
                  borderColor: selected ? styles.hex : styles.border,
                }}
              >
                {item.name} {categoryCounts.counts.get(item.id) ?? 0}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCategory(category === UNCATEGORIZED_FILTER ? "" : UNCATEGORIZED_FILTER)}
            className={`min-h-11 shrink-0 rounded-full border px-3 text-sm font-medium ${category === UNCATEGORIZED_FILTER ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
          >
            {uncategorizedLabel} {categoryCounts.uncategorized}
          </button>
        </div>

        <div className="hidden md:block">{filterControls}</div>

        <p className="text-sm text-slate-500">
          {activeFilters.length
            ? t("projects.showing", { shown: String(rows.length), total: String(scoped.length) })
            : t("projects.count", { count: String(scoped.length) })}
        </p>
        {activeFilters.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{t("projects.activeFilters")}</span>
            {activeFilters.map((item) => (
              <button key={item.key} type="button" onClick={item.clear} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700">
                {item.label} <X className="h-3.5 w-3.5" />
              </button>
            ))}
            <GhostButton onClick={clearFilters}>{t("projects.clearAll")}</GhostButton>
          </div>
        ) : null}
      </div>

      {rows.length ? (
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((project) => {
            const stats = statsById.get(project.id) ?? { total: 0, done: 0, open: 0, late: 0, progress: 0 };
            const resolved = resolveProjectCategory(project, data.departmentCategories);
            const styles = categoryStyles(resolved.color);
            const archived = !project.isActive;
            return (
              <article
                key={project.id}
                className={`flex h-full flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:shadow-md ${archived ? "opacity-70" : ""}`}
                style={{ borderColor: styles.border, background: styles.background }}
              >
                <Link href={`/projects/${project.id}`} className="flex flex-1 flex-col text-start">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: styles.badge, color: styles.badgeText }}>
                        {resolved.name}
                      </span>
                    <StatusBadge value={archived ? "ARCHIVED" : project.status} label={archived ? t("common.archive") : labelOf(project.status)} />
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-900">{project.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{t("projects.categoryLine", { name: resolved.name })}</p>
                  {[project.clientName, project.location, project.projectNumber].filter(Boolean).length ? (
                    <p className="mt-1 text-xs text-slate-500">{[project.clientName, project.location, project.projectNumber].filter(Boolean).join(" · ")}</p>
                  ) : null}
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-white/80">
                      <div className="h-full rounded-full" style={{ width: `${stats.progress}%`, background: styles.progress }} />
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-700">{stats.progress}%</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("projects.taskStats", {
                        total: String(stats.total),
                        done: String(stats.done),
                        open: String(stats.open),
                        late: String(stats.late),
                      })}
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{t("projects.manager", { name: employeeName(data.employees, project.managerEmployeeId) })}</p>
                </Link>
                {canManage ? (
                  <div className="mt-4 flex flex-wrap gap-1">
                    <GhostButton onClick={() => openDraft(project)}>{t("common.edit")}</GhostButton>
                    <select
                      className="h-10 rounded-xl border border-slate-200 bg-white px-2 text-xs"
                      value={project.status}
                      disabled={busy}
                      onChange={(event) => void act("updateProject", project, {
                        name: project.name,
                        clientName: project.clientName,
                        description: project.description,
                        managerEmployeeId: project.managerEmployeeId,
                        departmentId: project.departmentId,
                        categoryId: project.categoryId,
                        categoryName: project.categoryName,
                        location: project.location,
                        projectNumber: project.projectNumber,
                        startDate: project.startDate,
                        dueDate: project.dueDate,
                        status: event.target.value,
                        progress: project.progress,
                        isActive: project.isActive,
                      })}
                    >
                      {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
                    </select>
                    <GhostButton disabled={busy} onClick={() => void act(project.isActive ? "archiveProject" : "restoreProject", project)}>
                      {project.isActive ? t("common.archive") : t("projects.restore")}
                    </GhostButton>
                    <GhostButton disabled={busy} onClick={() => void act("deleteProject", project)}>{t("common.delete")}</GhostButton>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : scoped.length ? (
        <EmptyState icon={FolderKanban} title={t("projects.noMatch")} action={<PrimaryButton onClick={clearFilters}>{t("projects.clearFilters")}</PrimaryButton>} />
      ) : (
        <EmptyState icon={FolderKanban} title={t("work.noProjects")} action={canManage ? <PrimaryButton onClick={() => openDraft()}>{t("projects.create")}</PrimaryButton> : undefined} />
      )}

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 md:bg-slate-900/30">
          <button type="button" className="absolute inset-0" aria-label={t("common.close")} onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:inset-auto md:end-6 md:top-24 md:w-[420px] md:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("projects.filter")}</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-50" aria-label={t("common.close")}><X className="h-5 w-5" /></button>
            </div>
            {filterControls}
            <div className="mt-5 flex gap-2">
              <GhostButton onClick={clearFilters}>{t("projects.clearFilters")}</GhostButton>
              <PrimaryButton onClick={() => setFiltersOpen(false)}>{t("projects.showResults")}</PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {draft ? (
        <Modal title={draft.id ? t("projects.edit") : t("projects.new")} onClose={() => setDraft(null)}>
          <div className="grid gap-3">
            <Field label={t("projects.name")}><input className={inputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
            <Field label={t("common.client")}><input className={inputClass} value={draft.clientName} onChange={(event) => setDraft({ ...draft, clientName: event.target.value })} /></Field>
            <Field label={t("common.description")}><textarea className={`${inputClass} h-24 py-2`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
            <Field label={t("common.department")}>
              <select
                className={inputClass}
                value={draft.departmentId}
                onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}
              >
                <option value="">{t("projects.pickDepartment")}</option>
                {data.departments.filter((item) => item.isActive || item.id === draft.departmentId).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("projects.categoryRequired")}>
              <select
                className={inputClass}
                value={draft.categoryId}
                onChange={(event) => {
                  const categoryId = event.target.value;
                  setDraft({ ...draft, categoryId });
                  const current = data.projects.find((item) => item.id === draft.id);
                  if (current && categoryId) {
                    void act("updateProject", current, {
                      name: draft.name,
                      clientName: draft.clientName,
                      description: draft.description,
                      managerEmployeeId: draft.managerEmployeeId,
                      departmentId: draft.departmentId,
                      categoryId,
                      location: draft.location,
                      projectNumber: draft.projectNumber,
                      startDate: draft.startDate,
                      dueDate: draft.dueDate,
                      status: draft.status,
                      progress: draft.progress,
                      isActive: true,
                    });
                  }
                }}
              >
                <option value="">{draft.id ? uncategorizedLabel : t("projects.pickCategory")}</option>
                {draftCategories.map((item) => <option key={item.id} value={item.id}>● {item.name}</option>)}
              </select>
            </Field>
            {draftCategories.length === 0 ? (
              <p className="text-xs text-amber-700">{t("projects.noCategories")}</p>
            ) : null}
            {draft.categoryId ? (
              <p className="text-xs" style={{ color: categoryStyles(data.departmentCategories.find((item) => item.id === draft.categoryId)?.color).badgeText }}>
                ● {data.departmentCategories.find((item) => item.id === draft.categoryId)?.name}
              </p>
            ) : null}
            <Field label={t("projects.managerLabel")}>
              <select className={inputClass} value={draft.managerEmployeeId} onChange={(event) => setDraft({ ...draft, managerEmployeeId: event.target.value })}>
                <option value="">{t("projects.none")}</option>
                {data.employees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
              </select>
            </Field>
            <Field label={t("common.status")}>
              <select className={inputClass} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
              </select>
            </Field>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-700">{t("projects.progressPct")}</p>
                <p className="text-sm font-semibold text-slate-900">{draft.progress}%</p>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={draft.progress}
                onChange={(event) => setDraft({ ...draft, progress: normalizeProjectProgress(event.target.value) })}
                className="mt-3 h-11 w-full accent-[var(--brand-primary)]"
                dir="ltr"
                aria-label={t("projects.progressPct")}
              />
              <div className="mt-2 flex items-center justify-center gap-2">
                <input
                  className={`${inputClass} w-24 text-center`}
                  inputMode="numeric"
                  value={String(draft.progress)}
                  onChange={(event) => setDraft({ ...draft, progress: normalizeProjectProgress(event.target.value) })}
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {[0, 25, 50, 75, 100].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`min-h-11 rounded-xl border px-3 text-xs font-medium ${draft.progress === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                    onClick={() => setDraft({ ...draft, progress: value })}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>
            <Field label={t("common.location")}><input className={inputClass} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></Field>
            <Field label={t("projects.number")}><input className={inputClass} value={draft.projectNumber} onChange={(event) => setDraft({ ...draft, projectNumber: event.target.value })} /></Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("common.start")}><input className={inputClass} value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></Field>
              <Field label={t("common.deadline")}><input className={inputClass} value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setDraft(null)}>{t("common.cancel")}</GhostButton>
              <PrimaryButton disabled={busy || !draft.name.trim() || (!draft.id && !draft.categoryId)} onClick={() => void save()}>{t("common.save")}</PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
