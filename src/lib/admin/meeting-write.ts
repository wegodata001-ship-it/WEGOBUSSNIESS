import { writeActivity } from "@/lib/admin/activity";
import { dateTimeInZone, formatDateDisplay, toSafeDate, zonedDateTime } from "@/lib/admin/meeting-time";
import { notifyEmployees } from "@/lib/admin/notify";
import { actorCan, type ServerActor } from "@/lib/auth/server-actor";
import { isDateOnly, isTimeOnly } from "@/lib/dates/format";
import { DEFAULT_TIMEZONE } from "@/lib/env";
import { getAdminDb } from "@/lib/firebase/admin";
import { businessDocPath, employeeDocPath, meetingDocPath, meetingsPath, projectDocPath } from "@/lib/firebase/paths";

export type MeetingWriteError = "FORBIDDEN" | "MEETING_FIELDS" | "MISSING_ID" | "NOT_FOUND";

export type MeetingWriteResult =
  | { ok: true; id: string }
  | { ok: false; error: MeetingWriteError; status: number };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: unknown) {
  const next = text(value);
  return next || null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))];
}

function dateOrNull(value: unknown) {
  const next = nullable(value);
  return next && isDateOnly(next) ? next : null;
}

function timeOrNull(value: unknown) {
  const next = nullable(value);
  return next && isTimeOnly(next) ? next : null;
}

export function canCreateMeeting(actor: ServerActor) {
  return actorCan(actor, "meetings.create") || actorCan(actor, "meetings.manage") || actor.isOwnerOrManager;
}

export function canManageAllMeetings(actor: ServerActor) {
  return actorCan(actor, "meetings.manage") || actor.isOwnerOrManager;
}

export function canEditMeetingDoc(actor: ServerActor, existing: { createdBy?: unknown; createdByUserId?: unknown }) {
  if (canManageAllMeetings(actor)) return true;
  const creator = text(existing.createdByUserId) || text(existing.createdBy);
  return Boolean(creator && creator === actor.uid);
}

export async function upsertMeeting(input: {
  actor: ServerActor;
  businessId: string;
  meetingId?: string;
  data: Record<string, unknown>;
}): Promise<MeetingWriteResult> {
  const { actor, businessId, data } = input;
  const isUpdate = Boolean(input.meetingId);
  const db = getAdminDb();
  const now = new Date();

  if (!isUpdate && !canCreateMeeting(actor)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }

  const existingSnap = isUpdate ? await db.doc(meetingDocPath(businessId, input.meetingId!)).get() : null;
  if (isUpdate && !existingSnap?.exists) {
    return { ok: false, error: "NOT_FOUND", status: 404 };
  }
  const existing = existingSnap?.data() ?? {};
  if (isUpdate && !canEditMeetingDoc(actor, existing)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }

  const businessSnap = await db.doc(businessDocPath(businessId)).get();
  const timezone = typeof businessSnap.data()?.timezone === "string" && businessSnap.data()!.timezone
    ? businessSnap.data()!.timezone
    : DEFAULT_TIMEZONE;

  const date = dateOrNull(data.date) || (isDateOnly(text(existing.date)) ? text(existing.date) : null);
  const startTime = timeOrNull(data.startTime) || (isTimeOnly(text(existing.startTime)) ? text(existing.startTime) : null);
  const endTime = timeOrNull(data.endTime) || (isTimeOnly(text(existing.endTime)) ? text(existing.endTime) : null);
  const startAt = toSafeDate(data.startAt)
    ?? (date && startTime ? zonedDateTime(date, startTime, timezone) : toSafeDate(existing.startAt));
  const endAt = toSafeDate(data.endAt)
    ?? (date && endTime ? zonedDateTime(date, endTime, timezone) : toSafeDate(existing.endAt))
    ?? (startAt ? new Date(startAt.getTime() + 60 * 60 * 1000) : null);
  const resolvedEndAt = startAt && endAt && endAt <= startAt
    ? new Date(startAt.getTime() + 30 * 60 * 1000)
    : endAt;
  const startParts = startAt ? dateTimeInZone(startAt, timezone) : null;
  const endParts = resolvedEndAt ? dateTimeInZone(resolvedEndAt, timezone) : null;
  const resolvedDate = startParts?.date || date;
  const resolvedStart = startParts?.time || startTime;
  if (!text(data.title) || !resolvedDate || !resolvedStart || !startAt) {
    return { ok: false, error: "MEETING_FIELDS", status: 400 };
  }

  const incoming = Array.isArray(data.participantIds)
    ? stringArray(data.participantIds)
    : stringArray(data.participantEmployeeIds);
  const participants = actor.employeeId && !incoming.includes(actor.employeeId)
    ? [...incoming, actor.employeeId]
    : incoming;
  for (const employeeId of participants) {
    const employee = await db.doc(employeeDocPath(businessId, employeeId)).get();
    if (!employee.exists) return { ok: false, error: "MEETING_FIELDS", status: 400 };
  }

  const projectId = nullable(data.projectId) ?? (typeof existing.projectId === "string" ? existing.projectId : null);
  if (projectId) {
    const project = await db.doc(projectDocPath(businessId, projectId)).get();
    if (!project.exists) return { ok: false, error: "MEETING_FIELDS", status: 400 };
  }

  const statusRaw = text(data.status) || text(existing.status) || "SCHEDULED";
  const status = statusRaw === "DONE" ? "COMPLETED" : statusRaw;
  const createdBy = isUpdate ? text(existing.createdBy) || text(existing.createdByUserId) || actor.uid : actor.uid;
  const createdByEmployeeId = isUpdate
    ? (typeof existing.createdByEmployeeId === "string" ? existing.createdByEmployeeId : actor.employeeId)
    : actor.employeeId;

  const payload = {
    businessId,
    title: text(data.title),
    description: text(data.description) || text(data.notes),
    notes: text(data.notes) || text(data.description),
    status,
    startAt,
    endAt: resolvedEndAt,
    date: resolvedDate,
    startTime: resolvedStart,
    endTime: endParts?.time || endTime,
    location: nullable(data.location) ?? existing.location ?? null,
    meetingType: text(data.meetingType) || existing.meetingType || "OTHER",
    color: text(data.color) || existing.color || "BLUE",
    projectId,
    participantIds: participants,
    participantEmployeeIds: participants,
    createdBy,
    createdByUserId: createdBy,
    createdByEmployeeId: createdByEmployeeId ?? null,
    updatedAt: now,
  };

  const ref = isUpdate
    ? db.doc(meetingDocPath(businessId, input.meetingId!))
    : db.collection(meetingsPath(businessId)).doc();
  await ref.set(isUpdate ? payload : { ...payload, createdAt: now }, { merge: true });

  const previousIds = stringArray(
    Array.isArray(existing.participantIds) && existing.participantIds.length
      ? existing.participantIds
      : existing.participantEmployeeIds,
  );
  const when = `${formatDateDisplay(resolvedDate)} · ${resolvedStart}${payload.endTime ? `–${payload.endTime}` : ""}`;
  const timeChanged = resolvedDate !== text(existing.date)
    || resolvedStart !== text(existing.startTime)
    || (payload.endTime ?? "") !== text(existing.endTime);

  if (!isUpdate) {
    await notifyEmployees({
      businessId,
      employeeIds: participants,
      title: `נוספת לפגישה חדשה: ${payload.title}`,
      body: `${payload.title}\n${when}`,
      href: "/meetings",
      type: "meeting.created",
      entityType: "meeting",
      entityId: ref.id,
      subject: "WEGO BIZ — נוספת לפגישה",
      rows: [
        { label: "פגישה", value: payload.title },
        { label: "תאריך", value: resolvedDate },
        { label: "שעה", value: `${resolvedStart}${payload.endTime ? `–${payload.endTime}` : ""}` },
      ],
      dedupeKey: `MEETING_CREATED:${ref.id}`,
    });
  } else if (status === "CANCELLED" && text(existing.status) !== "CANCELLED") {
    await notifyEmployees({
      businessId,
      employeeIds: participants,
      title: `הפגישה בוטלה: ${payload.title}`,
      body: `${payload.title}\n${when}`,
      href: "/meetings",
      type: "meeting.cancelled",
      entityType: "meeting",
      entityId: ref.id,
      subject: "WEGO BIZ — הפגישה בוטלה",
      dedupeKey: `MEETING_CANCELLED:${ref.id}`,
    });
  } else {
    const added = participants.filter((employeeId) => !previousIds.includes(employeeId));
    if (added.length) {
      await notifyEmployees({
        businessId,
        employeeIds: added,
        title: `נוספת לפגישה חדשה: ${payload.title}`,
        body: `${payload.title}\n${when}`,
        href: "/meetings",
        type: "meeting.created",
        entityType: "meeting",
        entityId: ref.id,
        subject: "WEGO BIZ — נוספת לפגישה",
        dedupeKey: `MEETING_ADDED:${ref.id}:${added.join(",")}`,
      });
    }
    if (timeChanged) {
      await notifyEmployees({
        businessId,
        employeeIds: participants,
        title: `עודכן זמן הפגישה: ${payload.title}`,
        body: `${payload.title}\n${when}`,
        href: "/meetings",
        type: "meeting.rescheduled",
        entityType: "meeting",
        entityId: ref.id,
      });
    }
  }

  await writeActivity({
    businessId,
    actorUserId: actor.uid,
    action: isUpdate ? "updateMeeting" : "createMeeting",
    entityType: "meeting",
    entityId: ref.id,
    message: `פגישה: ${payload.title}`,
  });

  return { ok: true, id: ref.id };
}

export async function deleteMeetingDoc(input: {
  actor: ServerActor;
  businessId: string;
  meetingId: string;
}): Promise<MeetingWriteResult> {
  if (!canManageAllMeetings(input.actor)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  if (!input.meetingId) {
    return { ok: false, error: "MISSING_ID", status: 400 };
  }
  const db = getAdminDb();
  const ref = db.doc(meetingDocPath(input.businessId, input.meetingId));
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: "NOT_FOUND", status: 404 };
  }
  await ref.delete();
  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "deleteMeeting",
    entityType: "meeting",
    entityId: input.meetingId,
    message: "פגישה נמחקה",
  });
  return { ok: true, id: input.meetingId };
}
