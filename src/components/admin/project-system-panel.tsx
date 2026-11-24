"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Field, GhostButton, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { mutateBusiness } from "@/lib/admin/api";
import { employeeName } from "@/lib/admin/catalog";
import {
  canCopyProjectCredential,
  canDeleteProjectCredential,
  canRevealProjectCredential,
  canSaveProjectCredential,
} from "@/lib/admin/project-credential-actions";
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
import { Copy, Eye, EyeOff, FileArchive, Wrench } from "lucide-react";

type Props = {
  businessId: string;
  project: Project;
  employees: Employee[];
  canManage: boolean;
  canManageCredentials?: boolean;
  onSaved: () => void;
};

const ACCEPT = Array.from(PROJECT_SYSTEM_ALLOWED_EXT).map((ext) => `.${ext}`).join(",");

export function ProjectSystemPanel({
  businessId,
  project,
  employees,
  canManage,
  canManageCredentials = false,
  onSaved,
}: Props) {
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
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(Boolean(project.systemDetails?.passwordConfigured));
  const [passwordDraft, setPasswordDraft] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [credentialBusy, setCredentialBusy] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState("");
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

  const loadCredentialStatus = useCallback(async () => {
    if (!canManageCredentials) {
      setEncryptionReady(false);
      setPasswordConfigured(Boolean(project.systemDetails?.passwordConfigured));
      return;
    }
    const response = await fetch(
      `/api/business/projects/${encodeURIComponent(project.id)}/credentials?businessId=${encodeURIComponent(businessId)}`,
      { credentials: "include", cache: "no-store" },
    );
    const payload = await response.json().catch(() => ({})) as {
      encryptionReady?: boolean;
      configured?: boolean;
    };
    if (response.ok) {
      setEncryptionReady(Boolean(payload.encryptionReady));
      setPasswordConfigured(Boolean(payload.configured));
    } else {
      setEncryptionReady(false);
      setPasswordConfigured(Boolean(project.systemDetails?.passwordConfigured));
    }
    // Do not depend on passwordConfigured — status reloads must not recreate this callback
    // and wipe the reauth field the owner is typing into.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, canManageCredentials, project.id]);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  // Reset vault fields only when switching projects (not after save/catalog refresh).
  useEffect(() => {
    setRevealedPassword(null);
    setPasswordDraft("");
    setAccountPassword("");
    setShowPassword(false);
    setCredentialMessage("");
  }, [project.id]);

  useEffect(() => {
    void loadCredentialStatus();
  }, [loadCredentialStatus]);

  const revealEnabled = canRevealProjectCredential({
    passwordConfigured,
    encryptionReady,
    credentialBusy,
    accountPassword,
  });
  const copyEnabled = canCopyProjectCredential({
    revealedPassword,
    credentialBusy,
  });
  const deleteEnabled = canDeleteProjectCredential({
    passwordConfigured,
    encryptionReady,
    credentialBusy,
    accountPassword,
  });
  const saveEnabled = canSaveProjectCredential({
    encryptionReady,
    credentialBusy,
    passwordDraft,
    accountPassword,
  });

  function credentialErrorMessage(code?: string) {
    if (code === "ENCRYPTION_NOT_CONFIGURED") return t("projects.system.passwordDisabled");
    if (code === "FORBIDDEN") return t("projects.system.passwordOwnerOnly");
    if (code === "REAUTH_REQUIRED" || code === "REAUTH_FAILED") return t("projects.system.reauthFailed");
    if (code === "TOO_MANY_ATTEMPTS") return t("projects.system.reauthLocked");
    if (code === "PASSWORD_REQUIRED") return t("projects.system.passwordRequired");
    if (code === "NOT_CONFIGURED") return t("projects.system.passwordMissing");
    return t("projects.system.saveFailed");
  }

  async function saveCredential() {
    if (!canManageCredentials || !encryptionReady) return;
    setCredentialBusy(true);
    setCredentialMessage("");
    setError("");
    try {
      const response = await fetch(`/api/business/projects/${encodeURIComponent(project.id)}/credentials`, {
        method: "PUT",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          password: passwordDraft,
          accountPassword,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(credentialErrorMessage(payload.error));
        return;
      }
      setPasswordConfigured(true);
      setPasswordDraft("");
      setAccountPassword("");
      setRevealedPassword(null);
      setCredentialMessage(t("projects.system.passwordSaved"));
      onSaved();
    } finally {
      setCredentialBusy(false);
    }
  }

  async function revealCredential(): Promise<string | null> {
    if (!canManageCredentials || !encryptionReady || !passwordConfigured) return null;
    if (!accountPassword.trim()) {
      setError(t("projects.system.reauthRequired"));
      return null;
    }
    setCredentialBusy(true);
    setCredentialMessage("");
    setError("");
    try {
      const response = await fetch(`/api/business/projects/${encodeURIComponent(project.id)}/credentials`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          action: "reveal",
          accountPassword,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; password?: string };
      if (!response.ok || !payload.password) {
        setError(credentialErrorMessage(payload.error));
        return null;
      }
      setRevealedPassword(payload.password);
      setShowPassword(true);
      setCredentialMessage(t("projects.system.passwordRevealed"));
      return payload.password;
    } finally {
      setCredentialBusy(false);
    }
  }

  async function deleteCredential() {
    if (!canManageCredentials || !passwordConfigured) return;
    if (!accountPassword.trim()) {
      setError(t("projects.system.reauthRequired"));
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(t("projects.system.deletePasswordConfirm"))) {
      return;
    }
    setCredentialBusy(true);
    setCredentialMessage("");
    setError("");
    try {
      const response = await fetch(`/api/business/projects/${encodeURIComponent(project.id)}/credentials`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          accountPassword,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(credentialErrorMessage(payload.error));
        return;
      }
      setPasswordConfigured(false);
      setRevealedPassword(null);
      setPasswordDraft("");
      setAccountPassword("");
      setShowPassword(false);
      setCredentialMessage(t("projects.system.passwordDeleted"));
      onSaved();
    } finally {
      setCredentialBusy(false);
    }
  }

  async function copyRevealedPassword() {
    let secret = revealedPassword;
    if (!secret) {
      secret = await revealCredential();
    }
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCredentialMessage(t("projects.system.passwordCopied"));
    } catch {
      setError(t("projects.system.copyFailed"));
    }
  }

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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input className={inputClass} disabled={!canManage} value={form.systemUrl ?? ""} onChange={(e) => patch("systemUrl", e.target.value || null)} placeholder="https://" />
            {form.systemUrl ? (
              <a href={form.systemUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm text-[var(--brand-primary)]">
                {t("common.open")}
              </a>
            ) : null}
          </div>
        </Field>
        <Field label={t("projects.system.adminUrl")}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input className={inputClass} disabled={!canManage} value={form.adminUrl ?? ""} onChange={(e) => patch("adminUrl", e.target.value || null)} placeholder="https://" />
            {form.adminUrl ? (
              <a href={form.adminUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm text-[var(--brand-primary)]">
                {t("common.open")}
              </a>
            ) : null}
          </div>
        </Field>
        <Field label={t("projects.system.username")}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input className={inputClass} disabled={!canManage} value={form.username} onChange={(e) => patch("username", e.target.value)} autoComplete="off" />
            {form.username ? (
              <GhostButton onClick={() => void navigator.clipboard.writeText(form.username).catch(() => undefined)}>
                <Copy className="h-4 w-4" />
              </GhostButton>
            ) : null}
          </div>
        </Field>
        <Field label={t("projects.system.password")}>
          {!canManageCredentials ? (
            <p className="text-sm text-slate-500">{t("projects.system.passwordOwnerOnly")}</p>
          ) : !encryptionReady ? (
            <>
              <input className={inputClass} disabled value="" placeholder={t("projects.system.passwordDisabled")} autoComplete="new-password" />
              <p className="mt-1 text-xs text-amber-700">{t("projects.system.passwordHint")}</p>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                {passwordConfigured ? t("projects.system.passwordConfigured") : t("projects.system.passwordMissing")}
              </p>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">{t("projects.system.vaultPasswordLabel")}</p>
                <input
                  className={inputClass}
                  type={showPassword && revealedPassword ? "text" : "password"}
                  value={revealedPassword && showPassword ? revealedPassword : passwordDraft}
                  onChange={(e) => {
                    setRevealedPassword(null);
                    setPasswordDraft(e.target.value);
                  }}
                  placeholder={passwordConfigured ? t("projects.system.passwordChangePlaceholder") : t("projects.system.passwordPlaceholder")}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">{t("projects.system.reauthLabel")}</p>
                <input
                  className={inputClass}
                  type="password"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  placeholder={t("projects.system.reauthPlaceholder")}
                  autoComplete="current-password"
                />
                <p className="mt-1 text-xs text-slate-500">{t("projects.system.reauthHint")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={!saveEnabled} onClick={() => void saveCredential()}>
                  {t("projects.system.savePassword")}
                </PrimaryButton>
                <GhostButton disabled={!revealEnabled} onClick={() => void revealCredential()}>
                  {t("projects.system.revealPassword")}
                </GhostButton>
                <GhostButton
                  disabled={!copyEnabled}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="ms-1">{showPassword ? t("projects.system.hidePassword") : t("projects.system.showPassword")}</span>
                </GhostButton>
                <GhostButton
                  disabled={credentialBusy || !(revealedPassword || revealEnabled)}
                  onClick={() => void copyRevealedPassword()}
                >
                  <Copy className="h-4 w-4" />
                  <span className="ms-1">{t("projects.system.copyPassword")}</span>
                </GhostButton>
                <GhostButton disabled={!deleteEnabled} onClick={() => void deleteCredential()}>
                  {t("projects.system.deletePassword")}
                </GhostButton>
              </div>
              {credentialMessage ? <p className="text-sm text-emerald-700">{credentialMessage}</p> : null}
            </div>
          )}
        </Field>
        <Field label={t("projects.system.github")}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input className={inputClass} disabled={!canManage} value={form.githubUrl ?? ""} onChange={(e) => patch("githubUrl", e.target.value || null)} placeholder="https://github.com/..." />
            {form.githubUrl ? (
              <a href={form.githubUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm text-[var(--brand-primary)]">
                {t("common.open")}
              </a>
            ) : null}
          </div>
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
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-1 flex justify-end rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
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
