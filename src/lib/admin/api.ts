export async function postAttendance(
  action: "clock-in" | "clock-out" | "correct",
  body: Record<string, unknown>,
) {
  const response = await fetch(`/api/attendance/${action}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    sessionId?: string;
    error?: string;
    durationMinutes?: number;
    startTime?: string | null;
    endTime?: string | null;
  };
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "ATTENDANCE_FAILED");
  }
  return payload;
}

export {
  businessMutationMessage,
  changeBusinessTaskStatus,
  decideBusinessTask,
  deleteBusinessMeeting,
  fetchTaskThread,
  markNotifications,
  postTaskComment,
  saveBusinessMeeting,
  saveBusinessTask,
  type BusinessMutationResult,
} from "@/lib/business/api";

export function meetingMutationMessage(
  error: string,
  t: (key: "meetings.forbidden" | "meetings.invalid" | "meetings.network") => string,
) {
  if (error === "FORBIDDEN") return t("meetings.forbidden");
  if (error === "MEETING_FIELDS") return t("meetings.invalid");
  return t("meetings.network");
}

export function taskMutationMessage(
  error: string,
  t: (key: "tasks.forbidden" | "tasks.invalid" | "tasks.network") => string,
) {
  if (error === "FORBIDDEN") return t("tasks.forbidden");
  if (error === "TASK_FIELDS" || error === "TITLE_REQUIRED" || error === "INVALID_PROJECT" || error === "INVALID_DEPARTMENT") {
    return t("tasks.invalid");
  }
  return t("tasks.network");
}

export async function mutateBusiness(input: {
  businessId: string;
  action: string;
  id?: string;
  data?: Record<string, unknown>;
}) {
  const response = await fetch("/api/business/mutate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "MUTATE_FAILED");
  }
  return payload;
}

export async function uploadBusinessDocument(form: FormData) {
  const response = await fetch("/api/business/documents", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "UPLOAD_FAILED");
  }
  return payload;
}

export async function deleteBusinessDocument(businessId: string, id: string) {
  const response = await fetch(
    `/api/business/documents?businessId=${encodeURIComponent(businessId)}&id=${encodeURIComponent(id)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!response.ok) throw new Error("DELETE_FAILED");
}

export async function documentDownloadUrl(businessId: string, id: string) {
  const response = await fetch(
    `/api/business/documents?businessId=${encodeURIComponent(businessId)}&id=${encodeURIComponent(id)}`,
    { credentials: "include", cache: "no-store" },
  );
  const payload = (await response.json()) as { url?: string; name?: string };
  if (!payload.url) throw new Error("NO_URL");
  return payload;
}
