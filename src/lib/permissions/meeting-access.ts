import type { Meeting } from "@/types/meeting";
import type { Permission } from "@/types/permissions";
import { hasPermission } from "@/lib/permissions/engine";

export type MeetingAccessActor = {
  uid: string;
  employeeId: string | null;
  isOwnerOrManager?: boolean;
  isSuperAdmin?: boolean;
  permissions: readonly Permission[];
};

export function canViewAllMeetings(actor: MeetingAccessActor) {
  if (actor.isSuperAdmin || actor.isOwnerOrManager) return true;
  return hasPermission(actor.permissions, "meetings.manage");
}

export function canSeeMeeting(
  actor: MeetingAccessActor,
  meeting: Pick<Meeting, "participantIds" | "participantEmployeeIds" | "createdByUserId" | "createdBy" | "createdByEmployeeId">,
) {
  if (canViewAllMeetings(actor)) return true;
  if (!hasPermission(actor.permissions, "meetings.view") && !actor.isSuperAdmin) return false;

  if (meeting.createdByUserId === actor.uid || meeting.createdBy === actor.uid) return true;
  if (actor.employeeId && meeting.createdByEmployeeId === actor.employeeId) return true;

  const participants = [
    ...(meeting.participantIds ?? []),
    ...(meeting.participantEmployeeIds ?? []),
  ];
  if (actor.employeeId && participants.includes(actor.employeeId)) return true;
  if (participants.includes(actor.uid)) return true;
  return false;
}

export function filterMeetingsForActor<T extends Parameters<typeof canSeeMeeting>[1]>(
  actor: MeetingAccessActor,
  meetings: T[],
) {
  if (canViewAllMeetings(actor)) return meetings;
  return meetings.filter((meeting) => canSeeMeeting(actor, meeting));
}
