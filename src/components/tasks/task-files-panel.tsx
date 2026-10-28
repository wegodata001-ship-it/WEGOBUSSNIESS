"use client";

import { useRef, useState } from "react";
import { Download, ExternalLink, FileText, Link2, Pencil, Trash2, Upload } from "lucide-react";
import { Field, GhostButton, PrimaryButton, inputClass } from "@/components/admin/ui";
import { employeeName } from "@/lib/admin/catalog";
import { canPreviewFile, formatBytes, linkService } from "@/lib/admin/task-link-meta";
import { dateTimeLabel } from "@/lib/admin/relative-time";
import {
  deleteTaskAttachment,
  deleteTaskLink,
  fetchTaskAttachmentUrl,
  renameTaskAttachment,
  saveTaskLink,
  uploadTaskAttachments,
} from "@/lib/business/api";
import type { Employee } from "@/types/employee";
import type { TaskAttachment, TaskLink } from "@/types/task";
import { useI18n } from "@/components/providers/i18n-provider";

export function TaskFilesPanel({
  businessId,
  taskId,
  attachments,
  links,
  employees,
  canChat,
  onChanged,
}: {
  businessId: string;
  taskId: string;
  attachments: TaskAttachment[];
  links: TaskLink[];
  employees: Employee[];
  canChat: boolean;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; name: string; contentType: string } | null>(null);
  const [linkDraft, setLinkDraft] = useState<{ id?: string; title: string; url: string; description: string } | null>(null);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length || !canChat) return;
    setBusy(true);
    setError("");
    const result = await uploadTaskAttachments({ businessId, taskId, files: list });
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "FILE_TOO_LARGE" ? t("work.fileTooLarge") : result.error === "FILE_TYPE" ? t("work.fileTypeDenied") : t("work.uploadFailed"));
      return;
    }
    onChanged();
  }

  async function openFile(item: TaskAttachment) {
    const result = await fetchTaskAttachmentUrl(businessId, taskId, item.id);
    if (!result.ok) return;
    if (canPreviewFile(item.contentType)) setPreview(result);
    else window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function downloadFile(item: TaskAttachment) {
    const result = await fetchTaskAttachmentUrl(businessId, taskId, item.id);
    if (!result.ok) return;
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">{t("work.filesAndDocs")}</p>
          {canChat ? (
            <GhostButton disabled={busy} onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" /> {t("work.addFiles")}
            </GhostButton>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files);
            event.target.value = "";
          }}
        />
        {canChat ? (
          <button
            type="button"
            onDragOver={(event) => { event.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDrag(false);
              void upload(event.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`mt-3 flex min-h-24 w-full items-center justify-center rounded-2xl border border-dashed px-4 text-sm ${drag ? "border-[var(--brand-primary)] bg-sky-50" : "border-slate-200 bg-slate-50 text-slate-500"}`}
          >
            {t("work.dropFiles")}
          </button>
        ) : null}
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-3 grid gap-2">
          {attachments.length ? attachments.map((item) => (
            <article key={item.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <p className="truncate font-medium text-slate-900">{item.name}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {item.contentType || item.fileName} · {formatBytes(item.size)} · {dateTimeLabel(item.createdAt)}
                </p>
                <p className="text-xs text-slate-400">{t("work.uploadedBy", { name: employeeName(employees, item.uploadedByEmployeeId) })}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {canPreviewFile(item.contentType) ? (
                  <GhostButton onClick={() => void openFile(item)}>{t("work.preview")}</GhostButton>
                ) : null}
                <GhostButton onClick={() => void downloadFile(item)}><Download className="h-4 w-4" /> {t("work.download")}</GhostButton>
                {canChat ? (
                  <GhostButton onClick={() => {
                    const next = window.prompt(t("work.renameFile"), item.name);
                    if (!next?.trim()) return;
                    void renameTaskAttachment({ businessId, taskId, attachmentId: item.id, name: next.trim() }).then(onChanged);
                  }}><Pencil className="h-4 w-4" /></GhostButton>
                ) : null}
                {canChat ? (
                  <GhostButton onClick={() => void deleteTaskAttachment({ businessId, taskId, attachmentId: item.id }).then(onChanged)}>
                    <Trash2 className="h-4 w-4" />
                  </GhostButton>
                ) : null}
              </div>
            </article>
          )) : <p className="text-sm text-slate-400">{t("work.noFiles")}</p>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">{t("work.addLink")}</p>
          {canChat ? (
            <GhostButton onClick={() => setLinkDraft({ title: "", url: "", description: "" })}>{t("work.addLink")}</GhostButton>
          ) : null}
        </div>
        {linkDraft ? (
          <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 p-3">
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
              <PrimaryButton
                disabled={busy || !linkDraft.title.trim() || !linkDraft.url.trim()}
                onClick={() => {
                  setBusy(true);
                  void saveTaskLink({
                    businessId,
                    taskId,
                    linkId: linkDraft.id,
                    title: linkDraft.title,
                    url: linkDraft.url,
                    description: linkDraft.description,
                  }).then((result) => {
                    setBusy(false);
                    if (!result.ok) {
                      setError(t("work.invalidUrl"));
                      return;
                    }
                    setLinkDraft(null);
                    onChanged();
                  });
                }}
              >
                {t("common.save")}
              </PrimaryButton>
            </div>
          </div>
        ) : null}
        <div className="mt-3 grid gap-2">
          {links.length ? links.map((item) => {
            const service = linkService(item.url);
            return (
              <article key={item.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                    <p className="truncate font-medium">{item.title}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{service.label}</span>
                  </div>
                  {item.description ? <p className="mt-1 text-xs text-slate-500">{item.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm">
                    <ExternalLink className="h-4 w-4" /> {t("work.openLink")}
                  </a>
                  {canChat ? (
                    <GhostButton onClick={() => setLinkDraft({ id: item.id, title: item.title, url: item.url, description: item.description })}>
                      <Pencil className="h-4 w-4" />
                    </GhostButton>
                  ) : null}
                  {canChat ? (
                    <GhostButton onClick={() => void deleteTaskLink({ businessId, taskId, linkId: item.id }).then(onChanged)}>
                      <Trash2 className="h-4 w-4" />
                    </GhostButton>
                  ) : null}
                </div>
              </article>
            );
          }) : <p className="text-sm text-slate-400">{t("work.noLinks")}</p>}
        </div>
      </section>

      {preview ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white">
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
    </div>
  );
}
