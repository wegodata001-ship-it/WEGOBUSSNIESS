"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Image as ImageIcon, Link2, Paperclip, Pencil, Trash2, Upload } from "lucide-react";
import { Field, GhostButton, PrimaryButton, inputClass } from "@/components/admin/ui";
import { canPreviewFile, formatBytes, linkService } from "@/lib/admin/task-link-meta";
import { fileExtension, isAllowedTaskFile, parseHttpsUrl, TASK_FILE_ACCEPT } from "@/lib/admin/task-file-rules";
import {
  deleteTaskAttachment,
  deleteTaskLink,
  fetchTaskAttachmentUrl,
  fetchTaskAttachments,
  fetchTaskLinks,
  saveTaskLink,
  uploadTaskAttachments,
} from "@/lib/business/api";
import { reviveSessionDates } from "@/lib/session/serialize";
import type { TaskAttachment, TaskLink } from "@/types/task";
import { useI18n } from "@/components/providers/i18n-provider";

export type FormFileItem = {
  key: string;
  name: string;
  size: number;
  type: string;
  status: "pending" | "uploading" | "ready" | "failed";
  file?: File;
  attachmentId?: string;
  error?: string;
};

export type FormLinkItem = {
  key: string;
  title: string;
  url: string;
  description: string;
  linkId?: string;
  dirty?: boolean;
};

function FileKindIcon({ name, type }: { name: string; type: string }) {
  const ext = fileExtension(name);
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return <ImageIcon className="h-4 w-4 shrink-0 text-sky-600" />;
  }
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />;
  return <FileText className="h-4 w-4 shrink-0 text-slate-500" />;
}

export function TaskFormAssets({
  businessId,
  taskId,
  canManage,
  files,
  links,
  onFilesChange,
  onLinksChange,
}: {
  businessId: string;
  taskId?: string;
  canManage: boolean;
  files: FormFileItem[];
  links: FormLinkItem[];
  onFilesChange: (next: FormFileItem[]) => void;
  onLinksChange: (next: FormLinkItem[]) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [linkDraft, setLinkDraft] = useState<FormLinkItem | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; contentType: string } | null>(null);

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    let lastError = "";
    for (const file of Array.from(list)) {
      const allowed = isAllowedTaskFile(file);
      if (!allowed.ok) {
        lastError = allowed.error === "FILE_TOO_LARGE" ? t("work.fileTooLarge") : t("work.fileTypeDenied");
        continue;
      }
      next.push({
        key: `local-${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "pending",
        file,
      });
    }
    setError(lastError);
    onFilesChange(next);
  }

  async function openSaved(item: FormFileItem) {
    if (!taskId || !item.attachmentId) {
      if (item.file) {
        const url = URL.createObjectURL(item.file);
        setPreview({ url, name: item.name, contentType: item.type });
      }
      return;
    }
    const result = await fetchTaskAttachmentUrl(businessId, taskId, item.attachmentId);
    if (!result.ok) return;
    if (canPreviewFile(item.type) || canPreviewFile(result.contentType)) setPreview(result);
    else window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function removeFile(item: FormFileItem) {
    if (item.attachmentId) {
      if (!window.confirm(t("work.confirmDeleteFile"))) return;
      if (!taskId) return;
      const result = await deleteTaskAttachment({ businessId, taskId, attachmentId: item.attachmentId });
      if (!result.ok) {
        setError(t("work.uploadFailed"));
        return;
      }
    }
    onFilesChange(files.filter((file) => file.key !== item.key));
  }

  async function removeLink(item: FormLinkItem) {
    if (item.linkId) {
      if (!window.confirm(t("work.confirmDeleteLink"))) return;
      if (!taskId) return;
      const result = await deleteTaskLink({ businessId, taskId, linkId: item.linkId });
      if (!result.ok) {
        setError(t("work.uploadFailed"));
        return;
      }
    }
    onLinksChange(links.filter((link) => link.key !== item.key));
  }

  function saveLinkDraft() {
    if (!linkDraft) return;
    const url = parseHttpsUrl(linkDraft.url);
    if (!linkDraft.title.trim() || !url) {
      setError(t("work.invalidUrl"));
      return;
    }
    const next: FormLinkItem = { ...linkDraft, url, title: linkDraft.title.trim(), dirty: true };
    const exists = links.some((item) => item.key === next.key);
    onLinksChange(exists ? links.map((item) => item.key === next.key ? next : item) : [...links, next]);
    setLinkDraft(null);
    setError("");
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{t("work.tabFiles")}</p>
          <p className="text-xs text-slate-500">{t("work.fileCount", { count: String(files.length + links.length) })}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <GhostButton onClick={() => inputRef.current?.click()}>
              <Paperclip className="h-4 w-4" /> {t("work.attachFile")}
            </GhostButton>
            <GhostButton onClick={() => setLinkDraft({ key: `link-${Date.now()}`, title: "", url: "", description: "", dirty: true })}>
              <Link2 className="h-4 w-4" /> {t("work.addLink")}
            </GhostButton>
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={TASK_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {canManage ? (
        <button
          type="button"
          onDragOver={(event) => { event.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDrag(false);
            addFiles(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-3 hidden min-h-16 w-full items-center justify-center rounded-xl border border-dashed px-3 text-sm md:flex ${drag ? "border-[var(--brand-primary)] bg-sky-50" : "border-slate-200 bg-white text-slate-500"}`}
        >
          <Upload className="me-2 h-4 w-4" /> {t("work.dropFiles")}
        </button>
      ) : null}

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}

      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
        {files.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileKindIcon name={item.name} type={item.type} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                <p className="text-[11px] text-slate-500">
                  {formatBytes(item.size)} · {item.status === "pending" ? t("work.filePending") : item.status === "uploading" ? t("work.fileUploading") : item.status === "failed" ? t("work.fileFailed") : t("work.fileReady")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {item.status === "ready" || item.file ? (
                <GhostButton onClick={() => void openSaved(item)}><Download className="h-4 w-4" /></GhostButton>
              ) : null}
              {canManage ? <GhostButton onClick={() => void removeFile(item)}><Trash2 className="h-4 w-4" /></GhostButton> : null}
            </div>
          </div>
        ))}
        {links.map((item) => {
          const service = linkService(item.url);
          return (
            <div key={item.key} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-[11px] text-slate-500">{service.label} · {item.url}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-2 text-xs">{t("work.openLink")}</a>
                {canManage ? <GhostButton onClick={() => setLinkDraft(item)}><Pencil className="h-4 w-4" /></GhostButton> : null}
                {canManage ? <GhostButton onClick={() => void removeLink(item)}><Trash2 className="h-4 w-4" /></GhostButton> : null}
              </div>
            </div>
          );
        })}
      </div>

      {linkDraft ? (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <Field label={t("work.linkTitle")}>
            <input className={inputClass} value={linkDraft.title} onChange={(event) => setLinkDraft({ ...linkDraft, title: event.target.value })} />
          </Field>
          <Field label={t("work.linkUrl")}>
            <input className={inputClass} dir="ltr" value={linkDraft.url} onChange={(event) => setLinkDraft({ ...linkDraft, url: event.target.value })} placeholder="https://" />
          </Field>
          <Field label={t("work.linkDescription")}>
            <input className={inputClass} value={linkDraft.description} onChange={(event) => setLinkDraft({ ...linkDraft, description: event.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setLinkDraft(null)}>{t("common.cancel")}</GhostButton>
            <PrimaryButton disabled={!linkDraft.title.trim() || !linkDraft.url.trim()} onClick={saveLinkDraft}>{t("common.save")}</PrimaryButton>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="flex h-full max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <p className="truncate font-medium">{preview.name}</p>
              <GhostButton onClick={() => setPreview(null)}>{t("common.close")}</GhostButton>
            </div>
            <div className="min-h-0 flex-1 bg-slate-50">
              {preview.contentType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.name} className="h-full w-full object-contain" />
              ) : (
                <iframe title={preview.name} src={preview.url} className="h-full w-full" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export async function loadTaskFormAssets(businessId: string, taskId: string) {
  const [files, urls] = await Promise.all([
    fetchTaskAttachments(businessId, taskId),
    fetchTaskLinks(businessId, taskId),
  ]);
  const attachments = reviveSessionDates(files.attachments ?? []) as TaskAttachment[];
  const links = reviveSessionDates(urls.links ?? []) as TaskLink[];
  return {
    files: attachments.map((item) => ({
      key: item.id,
      name: item.name,
      size: item.size,
      type: item.contentType,
      status: "ready" as const,
      attachmentId: item.id,
    })),
    links: links.map((item) => ({
      key: item.id,
      title: item.title,
      url: item.url,
      description: item.description,
      linkId: item.id,
      dirty: false,
    })),
  };
}

export async function persistTaskFormAssets(input: {
  businessId: string;
  taskId: string;
  files: FormFileItem[];
  links: FormLinkItem[];
  onFilesChange: (next: FormFileItem[]) => void;
}) {
  const nextFiles = [...input.files];
  let failed = 0;
  for (let index = 0; index < nextFiles.length; index += 1) {
    const item = nextFiles[index];
    if (item.status === "ready" || !item.file) continue;
    nextFiles[index] = { ...item, status: "uploading" };
    input.onFilesChange([...nextFiles]);
    const result = await uploadTaskAttachments({ businessId: input.businessId, taskId: input.taskId, files: [item.file] });
    if (!result.ok) {
      nextFiles[index] = { ...item, status: "failed", error: result.error };
      failed += 1;
    } else {
      nextFiles[index] = { ...item, status: "ready", attachmentId: result.ids[0], file: undefined };
    }
    input.onFilesChange([...nextFiles]);
  }

  let linkFailed = 0;
  for (const item of input.links) {
    if (item.linkId && !item.dirty) continue;
    const result = await saveTaskLink({
      businessId: input.businessId,
      taskId: input.taskId,
      linkId: item.linkId,
      title: item.title,
      url: item.url,
      description: item.description,
    });
    if (!result.ok) linkFailed += 1;
    else {
      item.linkId = result.id;
      item.dirty = false;
    }
  }

  return { ok: failed === 0 && linkFailed === 0, files: nextFiles, failed: failed + linkFailed };
}
