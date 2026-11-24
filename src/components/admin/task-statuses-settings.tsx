"use client";

import { useState } from "react";
import { ColorPicker } from "@/components/admin/form-chips";
import { Field, GhostButton, Modal, PrimaryButton, StatusBadge, inputClass } from "@/components/admin/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { statusDefinitionName } from "@/lib/admin/task-status-label";
import type { CalendarColor } from "@/lib/admin/palette";
import { labelOf } from "@/lib/admin/labels";
import type { TaskStatusDefinition, TaskStatusType } from "@/types/task-status";
import { TASK_STATUS_TYPES } from "@/types/task-status";

export function TaskStatusesSettings({
  statuses,
  busy,
  onSave,
  onReorder,
}: {
  statuses: TaskStatusDefinition[];
  busy: boolean;
  onSave: (input: { id?: string; name: string; nameAr: string; color: CalendarColor; type: TaskStatusType; isActive: boolean }) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<{
    id?: string;
    name: string;
    nameAr: string;
    color: CalendarColor;
    type: TaskStatusType;
    isActive: boolean;
  } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <PrimaryButton onClick={() => setDraft({ name: "", nameAr: "", color: "BLUE", type: "TODO", isActive: true })}>
          {t("settings.newStatus")}
        </PrimaryButton>
      </div>
      <div className="grid gap-3 md:hidden">
        {statuses.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <StatusBadge value={item.type} label={statusDefinitionName(item, locale)} />
              <span className="text-xs text-slate-500">{item.isActive ? t("settings.statusActive") : t("settings.statusInactive")}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{labelOf(item.type)}</p>
            <div className="mt-3">
              <GhostButton onClick={() => setDraft({
                id: item.id,
                name: item.name,
                nameAr: item.nameAr,
                color: item.color,
                type: item.type,
                isActive: item.isActive,
              })}>{t("common.edit")}</GhostButton>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2 text-start">{t("settings.statusName")}</th>
              <th className="py-2 text-start">{t("settings.statusType")}</th>
              <th className="py-2 text-start">{t("common.status")}</th>
              <th className="py-2 text-start">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((item) => (
              <tr
                key={item.id}
                draggable
                onDragStart={() => setDragId(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!dragId || dragId === item.id) return;
                  const ids = statuses.map((row) => row.id);
                  const from = ids.indexOf(dragId);
                  const to = ids.indexOf(item.id);
                  if (from < 0 || to < 0) return;
                  ids.splice(from, 1);
                  ids.splice(to, 0, dragId);
                  void onReorder(ids);
                  setDragId(null);
                }}
                className="cursor-grab border-t border-slate-100"
              >
                <td className="py-2">
                  <StatusBadge value={item.type} label={statusDefinitionName(item, locale)} />
                </td>
                <td className="py-2">{labelOf(item.type)}</td>
                <td className="py-2">{item.isActive ? t("settings.statusActive") : t("settings.statusInactive")}</td>
                <td className="py-2">
                  <GhostButton onClick={() => setDraft({
                    id: item.id,
                    name: item.name,
                    nameAr: item.nameAr,
                    color: item.color,
                    type: item.type,
                    isActive: item.isActive,
                  })}>{t("common.edit")}</GhostButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft ? (
        <Modal title={draft.id ? t("common.edit") : t("settings.newStatus")} onClose={() => setDraft(null)}>
          <div className="grid gap-3">
            <Field label={t("settings.statusName")}>
              <input className={inputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </Field>
            <Field label={`${t("settings.statusName")} (AR)`}>
              <input className={inputClass} value={draft.nameAr} onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })} />
            </Field>
            <Field label={t("settings.statusType")}>
              <select
                className={inputClass}
                disabled={Boolean(draft.id && statuses.find((item) => item.id === draft.id)?.isSystem)}
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: event.target.value as TaskStatusType })}
              >
                {TASK_STATUS_TYPES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
              </select>
            </Field>
            <Field label={t("common.color")}>
              <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
              {t("settings.statusActive")}
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <GhostButton onClick={() => setDraft(null)}>{t("common.cancel")}</GhostButton>
            <PrimaryButton disabled={busy || !draft.name.trim()} onClick={() => void onSave(draft).then(() => setDraft(null))}>{t("common.save")}</PrimaryButton>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
