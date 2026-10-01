export type BusinessMutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status: number };

export function businessMutationMessage(
  error: string,
  t: (key: "meetings.forbidden" | "meetings.invalid" | "meetings.network" | "tasks.forbidden" | "tasks.invalid" | "tasks.network") => string,
  kind: "task" | "meeting" = "task",
) {
  if (error === "FORBIDDEN") return t(kind === "meeting" ? "meetings.forbidden" : "tasks.forbidden");
  if (error === "MEETING_FIELDS" || error === "TASK_FIELDS" || error === "TITLE_REQUIRED" || error === "INVALID_PROJECT" || error === "INVALID_DEPARTMENT") {
    return t(kind === "meeting" ? "meetings.invalid" : "tasks.invalid");
  }
  return t(kind === "meeting" ? "meetings.network" : "tasks.network");
}

export async function saveBusinessTask(input: {
  businessId: string;
  id?: string;
  data: Record<string, unknown>;
}): Promise<BusinessMutationResult> {
  const update = Boolean(input.id);
  const response = await fetch(update ? `/api/business/tasks/${input.id}` : "/api/business/tasks", {
    method: update ? "PATCH" : "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId: input.businessId, data: input.data }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error || !payload.id) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id };
}

export async function saveBusinessMeeting(input: {
  businessId: string;
  id?: string;
  data: Record<string, unknown>;
}): Promise<BusinessMutationResult> {
  const update = Boolean(input.id);
  const response = await fetch(update ? `/api/business/meetings/${input.id}` : "/api/business/meetings", {
    method: update ? "PATCH" : "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId: input.businessId, data: input.data }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error || !payload.id) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id };
}

export async function decideBusinessTask(input: {
  businessId: string;
  id: string;
  action: "approve" | "reject";
  reason?: string;
  data?: Record<string, unknown>;
}): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/tasks/${input.id}/decision`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: input.businessId,
      action: input.action,
      reason: input.reason,
      data: input.data,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.id };
}

export async function saveTaskWork(input: {
  businessId: string;
  id: string;
  data: {
    scheduledDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    description?: string;
    status?: string;
  };
}): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/tasks/${input.id}/work`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId: input.businessId, data: input.data }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.id };
}

export async function changeBusinessTaskStatus(input: {
  businessId: string;
  id: string;
  status: string;
  statusId?: string | null;
}): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/tasks/${input.id}/status`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId: input.businessId, status: input.status, statusId: input.statusId }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.id };
}

export async function fetchTaskThread(businessId: string, taskId: string) {
  const response = await fetch(
    `/api/business/tasks/${taskId}/thread?businessId=${encodeURIComponent(businessId)}`,
    { credentials: "include", cache: "no-store" },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    return { ok: false as const, error: payload.error || "FORBIDDEN", status: response.status, comments: [], activity: [] };
  }
  return { ok: true as const, ...payload };
}

export async function postTaskComment(input: {
  businessId: string;
  taskId: string;
  body: string;
  mentions: string[];
}): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/tasks/${input.taskId}/thread`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: input.businessId,
      body: input.body,
      mentions: input.mentions,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || "" };
}

export async function markNotifications(businessId: string, input: { id?: string; all?: boolean }) {
  const response = await fetch("/api/business/notifications", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, ...input }),
  });
  return response.ok;
}

export async function saveTaskPrice(input: {
  businessId: string;
  taskId: string;
  priceBeforeVat: number;
}): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/tasks/${input.taskId}/price`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId: input.businessId, priceBeforeVat: input.priceBeforeVat }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.taskId };
}

export async function receiveBusinessPayment(input: {
  businessId: string;
  taskIds: string[];
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
  allocations?: Array<{ taskId: string; amount: number }>;
}): Promise<BusinessMutationResult> {
  const response = await fetch("/api/business/payments", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || "" };
}

export async function fetchTaskPayments(businessId: string, taskId: string) {
  const response = await fetch(
    `/api/business/payments?businessId=${encodeURIComponent(businessId)}&taskId=${encodeURIComponent(taskId)}`,
    { credentials: "include", cache: "no-store" },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    return { ok: false as const, data: [] };
  }
  return { ok: true as const, data: payload.data ?? [] };
}

export async function voidBusinessPayment(input: {
  businessId: string;
  paymentId: string;
  reason?: string;
}): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/payments/${input.paymentId}/void`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.paymentId };
}

export async function deleteBusinessMeeting(businessId: string, id: string): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/meetings/${id}?businessId=${encodeURIComponent(businessId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || id };
}
