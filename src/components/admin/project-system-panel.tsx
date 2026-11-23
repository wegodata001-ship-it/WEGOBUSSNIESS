"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Field, GhostButton, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { mutateBusiness } from "@/lib/admin/api";
import { employeeName } from "@/lib/admin/catalog";
import { resolveProjectSystemFormSync } from "@/lib/admin/project-system-form-state";
import { PROJECT_SYSTEM_ALLOWED_EXT, PROJECT_SYSTEM_FILE_MAX_BYTES } from "@/lib/admin/project-system-rules";
import type { Employee } from "@/types/employee";
import type { Project } from "@/types/department";
import {
  emptyProjectSystemDetails,
  PROJECT_DB_KINDS,
  PROJECT_HOSTING_KINDS,
  type ProjectMaintenanceLog,
  type ProjectSystemDetails,
  type ProjectSystemFile,
} from "@/types/project-system";
import { FileArchive, Wrench } from "lucide-react";

type Props = {
  businessId: string;
  project: Project;
  employees: Employee[];
  canManage: boolean;
  onSaved: () => void;
};

const ACCEPT = Array.from(PROJECT_SYSTEM_ALLOWED_EXT).map((ext) => `.${ext}`).join(",");

export function ProjectSystemPanel({ businessId, project, employees, canManage, onSaved }: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<ProjectSystemDetails>(() => project.systemDetails ?? emptyProjectSystemDetails());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [files, setFiles] = useState<ProjectSystemFile[]>([]);
  const [logs, setLogs] = useState<ProjectMaintenanceLog[]>([]);
  const [logTitle, setLogTitle] = useState("");
  const [logBody, setLogBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const boundProjectIdRef = useRef<string | null>(project.id);

  useEffect(() => {
    const sync = resolveProjectSystemFormSync({
      previousProjectId: boundProjectIdRef.current,
      nextProjectId: project.id,
      dirty,
      incoming: project.systemDetails,
      current: form,
    });
    if (sync.didReset) {
      boundProjectIdRef.current = project.id;
      setForm(sync.form);
      setDirty(false);
      setSaved(false);
      setError("");
    }
    // Intentionally ignore project.systemDetails identity changes while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const loadExtras = useCallback(async () => {
    const [filesRes, logsRes] = await Promise.all([
      fetch(`/api/business/projects/${encodeURIComponent(project.id)}/system-files?businessId=${encodeURIComponent(businessId)}`, { credentials: "include" }),
      fetch(`/api/business/projects/${encodeURIComponent(project.id)}/maintenance?businessId=${encodeURIComponent(businessId)}`, { credentials: "include" }),
    ]);
    const filesPayload = await filesRes.json().catch(() => ({})) as { files?: ProjectSystemFile[] };
    const logsPayload = await logsRes.json().catch(() => ({})) as { logs?: ProjectMaintenanceLog[] };
    if (filesRes.ok) setFiles(filesPayload.files ?? []);
    if (logsRes.ok) setLogs(logsPayload.logs ?? []);
  }, [businessId, project.id]);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  function patch<K extends keyof ProjectSystemDetails>(key: K, value: ProjectSystemDetails[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    if (!canManage) return;
    setBusy(true);
    setError("");
    const snapshot = form;
    try {
      await mutateBusiness({
        businessId,
        action: "updateProjectSystemDetails",
        id: project.id,
        data: {
          systemName: snapshot.systemName,
          systemDescription: snapshot.systemDescription,
          systemUrl: snapshot.systemUrl,
          adminUrl: snapshot.adminUrl,
          username: snapshot.username,
          githubUrl: snapshot.githubUrl,
          databaseKind: snapshot.databaseKind,
          databaseNotes: snapshot.databaseNotes,
          hostingKind: snapshot.hostingKind,
          hostingNotes: snapshot.hostingNotes,
          domain: snapshot.domain,
          domainRenewalDate: snapshot.domainRenewalDate,
          ownerEmployeeId: snapshot.ownerEmployeeId,
          technicalNotes: snapshot.technicalNotes,
        },
      });
      setForm(snapshot);
      setDirty(false);
      setSaved(true);
      onSaved();
    } catch (err) {
      // Keep typed values intact on failure.
      setForm(snapshot);
      setDirty(true);
      const code = err instanceof Error ? err.message : "SAVE_FAILED";
      setError(code === "PASSWORD_PLAINTEXT_FORBIDDEN"
        ? t("projects.system.passwordDisabled")
        : t("projects.system.saveFailed"));
      setSaved(false);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | null) {
    if (!file || !canManage) return;
    if (file.size > PROJECT_SYSTEM_FILE_MAX_BYTES) {
      setError(t("projects.system.fileTooLarge"));
      return;
    }
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.set("businessId", businessId);
      body.set("file", file);
      const response = await fetch(`/api/business/projects/${encodeURIComponent(project.id)}/system-files`, {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        if (payload.error === "SECRET_FILE_DENIED") setError(t("projects.system.secretDenied"));
        else if (payload.error === "FILE_TYPE") setError(t("projects.system.fileType"));
        else setError(t("projects.system.uploadFailed"));
        return;
      }
      await loadExtras();
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(fileId: string) {
    if (!canManage) return;
    const response = await fetch(
      `/api/business/projects/${encodeURIComponent(project.id)}/system-files?businessId=${encodeURIComponent(businessId)}&fileId=${encodeURIComponent(fileId)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (response.ok) await loadExtras();
  }

  async function downloadFile(fileId: string) {
    const response = await fetch(
      `/api/business/projects/${encodeURIComponent(project.id)}/system-files?businessId=${encodeURIComponent(businessId)}&fileId=${encodeURIComponent(fileId)}`,
      { credentials: "include" },
    );
    const payload = await response.json().catch(() => ({})) as { url?: string };
    if (response.ok && payload.url) window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  async function addLog() {
    if (!canManage || !logTitle.trim()) return;
    setBusy(true);
    setError("");
    try {
      await mutateBusiness({
        businessId,
        action: "addProjectMaintenanceLog",
        id: project.id,
        data: { title: logTitle, body: logBody },
      });
      setLogTitle("");
      setLogBody("");
      await loadExtras();
    } catch {
      setError(t("projects.system.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <Field label={t("projects.system.name")}>
          <input className={inputClass} disabled={!canManage} value={form.systemName} onChange={(e) => patch("systemName", e.target.value)} />
        </Field>
        <Field label={t("projects.system.owner")}>
          <select
            className={inputClass}
            disabled={!canManage}
            value={form.ownerEmployeeId ?? ""}
            onChange={(e) => patch("ownerEmployeeId", e.target.value || null)}
          >
            <option value="">{t("projects.none")}</option>
            {employees.filter((item) => item.active !== false && item.status !== "INACTIVE").map((item) => (
              <option key={item.id} value={item.id}>{employeeName(employees, item.id)}</option>
            ))}
          </select>
        </Field>
        <Field label={t("projects.system.description")}>
          <textarea className={`${inputClass} h-24 py-2`} disabled={!canManage} value={form.systemDescription} onChange={(e) => patch("systemDescription", e.target.value)} />
        </Field>
        <Field label={t("projects.system.notes")}>
          <textarea className={`${inputClass} h-24 py-2`} disabled={!canManage} value={form.technicalNotes} onChange={(e) => patch("technicalNotes", e.target.value)} />
        </Field>
        <Field label={t("projects.system.url")}>
          <input className={inputClass} disabled={!canManage} value={form.systemUrl ?? ""} onChange={(e) => patch("systemUrl", e.target.value || null)} placeholder="https://" />
        </Field>
        <Field label={t("projects.system.adminUrl")}>
          <input className={inputClass} disabled={!canManage} value={form.adminUrl ?? ""} onChange={(e) => patch("adminUrl", e.target.value || null)} placeholder="https://" />
        </Field>
        <Field label={t("projects.system.username")}>
          <input className={inputClass} disabled={!canManage} value={form.username} onChange={(e) => patch("username", e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("projects.system.password")}>
          <input className={inputClass} disabled value="" placeholder={t("projects.system.passwordDisabled")} autoComplete="new-password" />
          <p className="mt-1 text-xs text-amber-700">{t("projects.system.passwordHint")}</p>
        </Field>
        <Field label={t("projects.system.github")}>
          <input className={inputClass} disabled={!canManage} value={form.githubUrl ?? ""} onChange={(e) => patch("githubUrl", e.target.value || null)} placeholder="https://github.com/..." />
        </Field>
        <Field label={t("projects.system.domain")}>
          <input className={inputClass} disabled={!canManage} value={form.domain} onChange={(e) => patch("domain", e.target.value)} />
        </Field>
        <Field label={t("projects.system.domainRenewal")}>
          <input type="date" className={inputClass} disabled={!canManage} value={form.domainRenewalDate ?? ""} onChange={(e) => patch("domainRenewalDate", e.target.value || null)} />
        </Field>
        <Field label={t("projects.system.database")}>
          <select className={inputClass} disabled={!canManage} value={form.databaseKind ?? ""} onChange={(e) => patch("databaseKind", (e.target.value || null) as ProjectSystemDetails["databaseKind"])}>
            <option value="">{t("projects.none")}</option>
            {PROJECT_DB_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
        </Field>
        <Field label={t("projects.system.databaseNotes")}>
          <input className={inputClass} disabled={!canManage} value={form.databaseNotes} onChange={(e) => patch("databaseNotes", e.target.value)} />
        </Field>
        <Field label={t("projects.system.hosting")}>
          <select className={inputClass} disabled={!canManage} value={form.hostingKind ?? ""} onChange={(e) => patch("hostingKind", (e.target.value || null) as ProjectSystemDetails["hostingKind"])}>
            <option value="">{t("projects.none")}</option>
            {PROJECT_HOSTING_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
        </Field>
        <Field label={t("projects.system.hostingNotes")}>
          <input className={inputClass} disabled={!canManage} value={form.hostingNotes} onChange={(e) => patch("hostingNotes", e.target.value)} />
        </Field>
      </div>

      {error ? <p className="text-sm text-rose-600" role="alert">{error}</p> : null}
      {saved && !dirty ? <p className="text-sm text-emerald-700" role="status">{t("projects.system.saved")}</p> : null}
      {dirty && !busy ? <p className="text-xs text-slate-500">{t("projects.system.unsaved")}</p> : null}

      {canManage ? (
        <div className="flex justify-end">
          <PrimaryButton disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? t("work.saving") : t("common.save")}
          </PrimaryButton>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{t("projects.system.files")}</h3>
          {canManage ? (
            <label className="inline-flex cursor-pointer items-center rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {uploading ? t("common.loading") : t("projects.system.upload")}
              <input type="file" accept={ACCEPT} className="hidden" disabled={uploading} onChange={(e) => void upload(e.target.files?.[0] ?? null)} />
            </label>
          ) : null}
        </div>
        <p className="mb-3 text-xs text-slate-500">{t("projects.system.filesHint")}</p>
        {files.length ? files.map((file) => (
          <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-2 text-sm first:border-0">
            <button type="button" className="text-start text-[var(--brand-primary)]" onClick={() => void downloadFile(file.id)}>{file.name || file.fileName}</button>
            {canManage ? <GhostButton onClick={() => void removeFile(file.id)}>{t("common.delete")}</GhostButton> : null}
          </div>
        )) : <EmptyState icon={FileArchive} title={t("projects.system.noFiles")} />}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{t("projects.system.maintenance")}</h3>
        {canManage ? (
          <div className="mb-4 grid gap-3">
            <Field label={t("projects.system.logTitle")}>
              <input className={inputClass} value={logTitle} onChange={(e) => setLogTitle(e.target.value)} />
            </Field>
            <Field label={t("projects.system.logBody")}>
              <textarea className={`${inputClass} h-20 py-2`} value={logBody} onChange={(e) => setLogBody(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <PrimaryButton disabled={busy || !logTitle.trim()} onClick={() => void addLog()}>{t("projects.system.addLog")}</PrimaryButton>
            </div>
          </div>
        ) : null}
        {logs.length ? logs.map((log) => (
          <div key={log.id} className="border-t border-slate-100 py-2 first:border-0">
            <p className="text-sm font-medium text-slate-800">{log.title}</p>
            {log.body ? <p className="text-sm text-slate-600">{log.body}</p> : null}
          </div>
        )) : <EmptyState icon={Wrench} title={t("projects.system.noLogs")} />}
      </div>
    </div>
  );
}
