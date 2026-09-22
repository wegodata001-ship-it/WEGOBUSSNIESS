"use client";

import { EmployeeMultiSelect } from "@/components/admin/employee-multi-select";
import { ColorPicker } from "@/components/admin/form-chips";
import { DatePicker, Field, GhostButton, Modal, PrimaryButton, inputClass } from "@/components/admin/ui";
import { employeeName, projectName } from "@/lib/admin/catalog";
import { formatDateDisplay, formatDayTitle, meetingParticipants } from "@/lib/admin/meeting-time";
import type { Department, Project } from "@/types/department";
import type { Employee } from "@/types/employee";
import {
  MEETING_LOCATIONS,
  MEETING_TYPE_LABELS,
  MEETING_TYPES,
  displayMeetingStatus,
  type Meeting,
  type MeetingType,
} from "@/types/meeting";

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

export function emptyMeetingDraft(date: string, startTime = "10:00", endTime = "11:00"): MeetingDraft {
  return {
    title: "",
    description: "",
    date,
    startTime,
    endTime,
    participantIds: [],
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
}: {
  draft: MeetingDraft;
  employees: Employee[];
  departments: Department[];
  projects: Project[];
  busy: boolean;
  onChange: (next: MeetingDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const locationOptions = MEETING_LOCATIONS.includes(draft.location as (typeof MEETING_LOCATIONS)[number])
    ? MEETING_LOCATIONS
    : [draft.location, ...MEETING_LOCATIONS];

  return (
    <Modal title={draft.id ? "עריכת פגישה" : "פגישה חדשה"} onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="כותרת *">
            <input className={inputClass} value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
          </Field>
        </div>
        <Field label="תאריך">
          <DatePicker value={draft.date} onChange={(date) => onChange({ ...draft, date })} />
          <p className="mt-1 text-xs text-slate-500" dir="ltr">{formatDateDisplay(draft.date)}</p>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="שעת התחלה">
            <input className={inputClass} dir="ltr" value={draft.startTime} onChange={(event) => onChange({ ...draft, startTime: event.target.value })} />
          </Field>
          <Field label="שעת סיום">
            <input className={inputClass} dir="ltr" value={draft.endTime} onChange={(event) => onChange({ ...draft, endTime: event.target.value })} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="משתתפים">
            <EmployeeMultiSelect
              employees={employees}
              departments={departments}
              value={draft.participantIds}
              placeholder="חפש עובד..."
              onChange={(participantIds) => onChange({ ...draft, participantIds })}
            />
          </Field>
        </div>
        <Field label="מיקום">
          <select className={inputClass} value={draft.location} onChange={(event) => onChange({ ...draft, location: event.target.value })}>
            {locationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="פרויקט">
          <select className={inputClass} value={draft.projectId} onChange={(event) => onChange({ ...draft, projectId: event.target.value })}>
            <option value="">בחר פרויקט</option>
            {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="צבע">
            <ColorPicker value={draft.color} onChange={(color) => onChange({ ...draft, color })} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="סוג פגישה">
            <select className={inputClass} value={draft.meetingType} onChange={(event) => onChange({ ...draft, meetingType: event.target.value as MeetingType })}>
              {MEETING_TYPES.map((item) => <option key={item} value={item}>{MEETING_TYPE_LABELS[item]}</option>)}
            </select>
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="תיאור / הערות">
            <textarea className={`${inputClass} h-24 py-2`} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
          </Field>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onClose}>ביטול</GhostButton>
        <PrimaryButton disabled={busy || !draft.title.trim()} onClick={onSave}>{busy ? "שומר…" : "שמירת פגישה"}</PrimaryButton>
      </div>
    </Modal>
  );
}

export function MeetingQuickView({
  meeting,
  employees,
  projects,
  canManage,
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
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const people = meetingParticipants(meeting);
  return (
    <Modal title={meeting.title} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          {formatDayTitle(meeting.date)}
          <span className="ms-2" dir="ltr">{meeting.startTime}{meeting.endTime ? `–${meeting.endTime}` : ""}</span>
        </p>
        <section>
          <p className="mb-1 text-xs font-medium text-slate-500">משתתפים</p>
          {people.length
            ? <ul className="space-y-1">{people.map((id) => <li key={id}>{employeeName(employees, id)}</li>)}</ul>
            : <p>אין משתתפים</p>}
        </section>
        <p><span className="text-slate-500">מיקום: </span>{meeting.location || "—"}</p>
        <p><span className="text-slate-500">פרויקט: </span>{projectName(projects, meeting.projectId)}</p>
        <p><span className="text-slate-500">סוג: </span>{MEETING_TYPE_LABELS[meeting.meetingType]}</p>
        <p><span className="text-slate-500">סטטוס: </span>{displayMeetingStatus(meeting.status) === "COMPLETED" ? "הושלמה" : displayMeetingStatus(meeting.status) === "CANCELLED" ? "בוטלה" : "מתוכננת"}</p>
        {meeting.description ? <p className="leading-6 text-slate-600">{meeting.description}</p> : null}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <GhostButton onClick={onEdit}>עריכה</GhostButton>
        {canManage ? (
          <>
            <GhostButton disabled={busy} onClick={onComplete}>סיום פגישה</GhostButton>
            <GhostButton disabled={busy} onClick={onCancel}>ביטול פגישה</GhostButton>
            <GhostButton disabled={busy} onClick={onDelete}>מחיקה</GhostButton>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
