"use client";

import { EmployeeMultiSelect } from "@/components/admin/employee-multi-select";
import { ColorPicker } from "@/components/admin/form-chips";
import { DatePicker, Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/admin/ui";
import { useI18n } from "@/components/providers/i18n-provider";
import { employeeName, projectName } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";
import { formatDateDisplay, meetingParticipants } from "@/lib/admin/meeting-time";
import { isDateOnly } from "@/lib/dates/format";
import type { MessageKey } from "@/lib/i18n";
import type { Department, Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import {
  MEETING_LOCATIONS,
  MEETING_TYPES,
  displayMeetingStatus,
  type Meeting,
  type MeetingType,
} from "@/types/meeting";

const MEETING_TYPE_KEYS: Record<MeetingType, MessageKey> = {
  TEAM: "meetings.typeTeam",
  CLIENT: "meetings.typeClient",
  PROJECT: "meetings.typeProject",
  INTERNAL: "meetings.typeInternal",
  OTHER: "meetings.typeOther",
};

function locationLabel(value: string, t: (key: MessageKey) => string) {
  if (value === "משרד") return t("meetings.locationOffice");
  if (value === "אצל לקוח") return t("meetings.locationClient");
  if (value === "אחר") return t("common.other");
  return value;
}

function formatMeetingDay(dateOnly: string, locale: string) {
  if (!isDateOnly(dateOnly)) return "";
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IL-u-nu-latn" : "he-IL-u-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export type MeetingDraft = {
  id?: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  participantIds: string[];
  location: string;
  projectId: string;
  meetingType: MeetingType;
  color: string;
  status: Meeting["status"];
};

export function emptyMeetingDraft(date: string, startTime = "10:00", endTime = "11:00", participantIds: string[] = []): MeetingDraft {
  return {
    title: "",
    description: "",
    date,
    startTime,
    endTime,
    participantIds,
    location: "משרד",
    projectId: "",
    meetingType: "TEAM",
    color: "BLUE",
    status: "SCHEDULED",
  };
}

export function draftFromMeeting(meeting: Meeting): MeetingDraft {
  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description || meeting.notes,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime || "11:00",
    participantIds: meetingParticipants(meeting),
    location: meeting.location || "משרד",
    projectId: meeting.projectId ?? "",
    meetingType: meeting.meetingType,
    color: meeting.color || "BLUE",
    status: meeting.status,
  };
}

export function MeetingFormModal({
  draft,
  employees,
  departments,
  projects,
  busy,
  onChange,
  onClose,
  onSave,
  error,
}: {
  draft: MeetingDraft;
  employees: Employee[];
  departments: Department[];
  projects: Project[];
  busy: boolean;
  onChange: (next: MeetingDraft) => void;
  onClose: () => void;
  onSave: () => void;
  error?: string | null;
}) {
  const { t } = useI18n();
  const locationOptions = MEETING_LOCATIONS.includes(draft.location as (typeof MEETING_LOCATIONS)[number])
    ? MEETING_LOCATIONS
    : [draft.location, ...MEETING_LOCATIONS];

  return (
    <Modal title={draft.id ? t("common.edit") : t("create.meeting")} onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label={t("meetings.titleRequired")}>
            <input className={inputClass} value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
          </Field>
        </div>
        <Field label={t("common.date")}>
          <DatePicker value={draft.date} onChange={(date) => onChange({ ...draft, date })} />
          <p className="mt-1 text-xs text-slate-500" dir="ltr">{formatDateDisplay(draft.date)}</p>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("meetings.startTime")}>
            <input className={inputClass} dir="ltr" value={draft.startTime} onChange={(event) => onChange({ ...draft, startTime: event.target.value })} />
          </Field>
          <Field label={t("meetings.endTime")}>
            <input className={inputClass} dir="ltr" value={draft.endTime} onChange={(event) => onChange({ ...draft, endTime: event.target.value })} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t("meetings.participants")}>
            <EmployeeMultiSelect
              employees={employees}
              departments={departments}
              value={draft.participantIds}
              placeholder={t("meetings.searchEmployee")}
              onChange={(participantIds) => onChange({ ...draft, participantIds })}
            />
          </Field>
        </div>
        <Field label={t("common.location")}>
          <select className={inputClass} value={draft.location} onChange={(event) => onChange({ ...draft, location: event.target.value })}>
            {locationOptions.map((item) => <option key={item} value={item}>{locationLabel(item, t)}</option>)}
          </select>
        </Field>
        <Field label={t("common.project")}>
          <select className={inputClass} value={draft.projectId} onChange={(event) => onChange({ ...draft, projectId: event.target.value })}>
            <option value="">{t("meetings.pickProject")}</option>
            {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label={t("common.color")}>
            <ColorPicker value={draft.color} onChange={(color) => onChange({ ...draft, color })} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t("meetings.meetingType")}>
            <select className={inputClass} value={draft.meetingType} onChange={(event) => onChange({ ...draft, meetingType: event.target.value as MeetingType })}>
              {MEETING_TYPES.map((item) => <option key={item} value={item}>{t(MEETING_TYPE_KEYS[item])}</option>)}
            </select>
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t("meetings.notes")}>
            <textarea className={`${inputClass} h-24 py-2`} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
          </Field>
        </div>
      </div>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
        <PrimaryButton disabled={busy || !draft.title.trim()} onClick={onSave}>{busy ? t("meetings.saving") : t("meetings.save")}</PrimaryButton>
      </div>
    </Modal>
  );
}

export function MeetingQuickView({
  meeting,
  employees,
  projects,
  canManage,
  canEdit = canManage,
  busy,
  onClose,
  onEdit,
  onComplete,
  onCancel,
  onDelete,
}: {
  meeting: Meeting;
  employees: Employee[];
  projects: Project[];
  canManage: boolean;
  canEdit?: boolean;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useI18n();
  const people = meetingParticipants(meeting);
  const status = displayMeetingStatus(meeting.status);
  return (
    <Modal title={meeting.title} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          {formatMeetingDay(meeting.date, locale)}
          <span className="ms-2" dir="ltr">{meeting.startTime}{meeting.endTime ? `–${meeting.endTime}` : ""}</span>
        </p>
        <section>
          <p className="mb-1 text-xs font-medium text-slate-500">{t("meetings.participants")}</p>
          {people.length
            ? <ul className="space-y-1">{people.map((id) => <li key={id}>{employeeName(employees, id)}</li>)}</ul>
            : <p>{t("meetings.noParticipants")}</p>}
        </section>
        <p><span className="text-slate-500">{t("common.location")}: </span>{meeting.location ? locationLabel(meeting.location, t) : "—"}</p>
        <p><span className="text-slate-500">{t("common.project")}: </span>{projectName(projects, meeting.projectId)}</p>
        <p><span className="text-slate-500">{t("common.type")}: </span>{t(MEETING_TYPE_KEYS[meeting.meetingType])}</p>
        <p><span className="text-slate-500">{t("common.status")}: </span>{labelOf(status)}</p>
        {meeting.description ? <p className="leading-6 text-slate-600">{meeting.description}</p> : null}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {canEdit ? <GhostButton onClick={onEdit}>{t("common.edit")}</GhostButton> : null}
        {canEdit ? (
          <>
            <GhostButton disabled={busy} onClick={onComplete}>{t("meetings.complete")}</GhostButton>
            <GhostButton disabled={busy} onClick={onCancel}>{t("meetings.cancelMeeting")}</GhostButton>
          </>
        ) : null}
        {canManage ? <GhostButton disabled={busy} onClick={onDelete}>{t("common.delete")}</GhostButton> : null}
      </div>
    </Modal>
  );
}
