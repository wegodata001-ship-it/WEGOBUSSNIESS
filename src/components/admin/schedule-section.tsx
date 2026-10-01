"use client";

import { useState } from "react";
import {
  MeetingFormModal,
  MeetingQuickView,
  draftFromMeeting,
  emptyMeetingDraft,
  type MeetingDraft,
} from "@/components/admin/meeting-modals";
import { useI18n } from "@/components/providers/i18n-provider";
import { deleteBusinessMeeting, meetingMutationMessage, saveBusinessMeeting } from "@/lib/admin/api";
import { meetingParticipants } from "@/lib/admin/meeting-time";
import {
  SCHEDULE_TONE,
  buildSchedule,
  type ScheduleKind,
  type ScheduleRange,
} from "@/lib/admin/schedule";
import type { BusinessCatalog } from "@/lib/admin/catalog";
import type { Meeting } from "@/types/meeting";

const KIND_KEY: Record<ScheduleKind, "schedule.task" | "schedule.meeting" | "schedule.deadline" | "schedule.attendance" | "schedule.request"> = {
  task: "schedule.task",
  meeting: "schedule.meeting",
  deadline: "schedule.deadline",
  attendance: "schedule.attendance",
  request: "schedule.request",
};

export function ScheduleSection({
  title,
  data,
  today,
  businessId,
  employeeId,
  canManageMeetings,
  onReload,
  compact = false,
}: {
  title?: string;
  data: BusinessCatalog;
  today: string;
  businessId: string;
  employeeId?: string | null;
  canManageMeetings: boolean;
  onReload: () => Promise<void> | void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [range, setRange] = useState<ScheduleRange>("today");
  const [quick, setQuick] = useState<Meeting | null>(null);
  const [draft, setDraft] = useState<MeetingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const items = buildSchedule(data, today, range, employeeId);

  async function persistMeeting(meeting: Meeting, patch: Record<string, unknown>) {
    setBusy(true);
    const result = await saveBusinessMeeting({
      businessId,
      id: meeting.id,
      data: {
        title: meeting.title,
        description: meeting.description,
        notes: meeting.notes,
        date: meeting.date,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        location: meeting.location,
        projectId: meeting.projectId,
        meetingType: meeting.meetingType,
        color: meeting.color || "BLUE",
        participantIds: meetingParticipants(meeting),
        status: meeting.status,
        ...patch,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setFormError(meetingMutationMessage(result.error, t));
      return;
    }
    setQuick(null);
    await onReload();
  }

  async function saveDraft() {
    if (!draft?.title.trim()) return;
    setBusy(true);
    setFormError(null);
    const result = await saveBusinessMeeting({
      businessId,
      id: draft.id,
      data: {
        title: draft.title,
        description: draft.description,
        notes: draft.description,
        date: draft.date,
        startTime: draft.startTime,
        endTime: draft.endTime,
        location: draft.location,
        projectId: draft.projectId || null,
        meetingType: draft.meetingType,
        color: draft.color || "BLUE",
        participantIds: draft.participantIds,
        status: draft.status,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setFormError(meetingMutationMessage(result.error, t));
      return;
    }
    setDraft(null);
    await onReload();
  }

  const tabs: Array<{ id: ScheduleRange; key: "schedule.today" | "schedule.tomorrow" | "schedule.week" }> = [
    { id: "today", key: "schedule.today" },
    { id: "tomorrow", key: "schedule.tomorrow" },
    { id: "week", key: "schedule.week" },
  ];

  return (
    <section id="home-schedule" className={`rounded-2xl border border-[#E2E8F0] bg-white ${compact ? "p-4" : "p-5"}`}>
      <div className={`mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${compact ? "mb-3" : "mb-4"}`}>
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">{title || t("schedule.title")}</h2>
          {compact ? null : <p className="mt-1 text-sm text-[#64748B]">{t("schedule.subtitle")}</p>}
        </div>
        <div className="flex gap-1 rounded-xl bg-[#F5F7FB] p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`h-9 rounded-lg px-3 text-sm font-medium ${range === item.id ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B]"}`}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
      </div>

      {items.length ? (
        <ol className={`relative border-s border-slate-200 ps-5 ${compact ? "space-y-2" : "space-y-4"}`}>
          {items.map((item) => {
            const tone = SCHEDULE_TONE[item.kind];
            return (
              <li key={item.id} className="relative">
                <span className={`absolute top-1.5 -start-[23px] h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                <button
                  type="button"
                  onClick={() => item.meeting ? setQuick(item.meeting) : undefined}
                  className={`w-full rounded-xl border border-transparent border-s-4 ${tone.border} bg-[#F8FAFC] px-3 py-2.5 text-start ${item.meeting ? "hover:bg-slate-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold tabular-nums text-[#0F172A]">
                      {item.time}{item.endTime ? `–${item.endTime}` : ""}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.badge}`}>
                      {t(KIND_KEY[item.kind])}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-[#0F172A]">{item.title}</p>
                  <p className="text-xs text-[#64748B]">
                    {[item.people, item.location].filter(Boolean).join(" · ")}
                  </p>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={compact ? "py-2" : "py-3"}>
          <p className="text-sm text-[#64748B]">{range === "today" ? t("work.noEventsToday") : t("schedule.empty")}</p>
          {compact && canManageMeetings ? (
            <button
              type="button"
              onClick={() => setDraft(emptyMeetingDraft(today))}
              className="mt-2 inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-[#2563EB]"
            >
              {t("work.newMeeting")}
            </button>
          ) : null}
        </div>
      )}

      {quick ? (
        <MeetingQuickView
          meeting={quick}
          employees={data.employees}
          projects={data.projects}
          canManage={canManageMeetings}
          busy={busy}
          onClose={() => setQuick(null)}
          onEdit={() => {
            setDraft(draftFromMeeting(quick));
            setQuick(null);
          }}
          onComplete={() => void persistMeeting(quick, { status: "COMPLETED" })}
          onCancel={() => void persistMeeting(quick, { status: "CANCELLED" })}
          onDelete={async () => {
            setBusy(true);
            const result = await deleteBusinessMeeting(businessId, quick.id);
            setBusy(false);
            if (!result.ok) {
              setFormError(meetingMutationMessage(result.error, t));
              return;
            }
            setQuick(null);
            await onReload();
          }}
        />
      ) : null}

      {draft ? (
        <MeetingFormModal
          draft={draft}
          employees={data.employees}
          departments={data.departments}
          projects={data.projects}
          busy={busy}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={() => void saveDraft()}
          error={formError}
        />
      ) : null}
    </section>
  );
}
