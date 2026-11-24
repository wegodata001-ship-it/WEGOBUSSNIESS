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
  attachments?: Array<{ id?: string | null; name: string; url?: string | null }>;
  linkUrl?: string | null;
  linkTitle?: string | null;
}): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/tasks/${input.taskId}/thread`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: input.businessId,
      body: input.body,
      mentions: input.mentions,
      attachments: input.attachments ?? [],
      linkUrl: input.linkUrl ?? null,
      linkTitle: input.linkTitle ?? null,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || "" };
}

export async function editTaskComment(input: {
  businessId: string;
  taskId: string;
  commentId: string;
  body: string;
}): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/tasks/${input.taskId}/thread`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: input.businessId,
      commentId: input.commentId,
      body: input.body,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.commentId };
}

export async function deleteTaskComment(input: {
  businessId: string;
  taskId: string;
  commentId: string;
}): Promise<BusinessMutationResult> {
  const response = await fetch(
    `/api/business/tasks/${input.taskId}/thread?businessId=${encodeURIComponent(input.businessId)}&commentId=${encodeURIComponent(input.commentId)}`,
    { method: "DELETE", credentials: "include" },
  );
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.commentId };
}

export async function markTaskThreadRead(businessId: string, taskId: string) {
  const response = await fetch(`/api/business/tasks/${taskId}/thread`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, markRead: true }),
  });
  return response.ok;
}

export async function fetchTaskAttachments(businessId: string, taskId: string) {
  const response = await fetch(
    `/api/business/tasks/${taskId}/attachments?businessId=${encodeURIComponent(businessId)}`,
    { credentials: "include", cache: "no-store" },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) return { ok: false as const, attachments: [] };
  return { ok: true as const, attachments: payload.attachments ?? [] };
}

export async function uploadTaskAttachments(input: {
  businessId: string;
  taskId: string;
  files: File[];
}) {
  const form = new FormData();
  form.set("businessId", input.businessId);
  for (const file of input.files) form.append("file", file);
  let response: Response;
  try {
    response = await fetch(`/api/business/tasks/${input.taskId}/attachments`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
  } catch {
    return { ok: false as const, error: "NETWORK", ids: [] as string[] };
  }
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; ids?: string[]; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false as const, error: payload.error || (response.status === 401 ? "AUTH_REQUIRED" : "NETWORK"), ids: [] as string[] };
  }
  return { ok: true as const, ids: payload.ids ?? (payload.id ? [payload.id] : []) };
}

export async function renameTaskAttachment(input: {
  businessId: string;
  taskId: string;
  attachmentId: string;
  name: string;
}): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/tasks/${input.taskId}/attachments/${input.attachmentId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId: input.businessId, name: input.name }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.attachmentId };
}

export async function deleteTaskAttachment(input: {
  businessId: string;
  taskId: string;
  attachmentId: string;
}): Promise<BusinessMutationResult> {
  const response = await fetch(
    `/api/business/tasks/${input.taskId}/attachments/${input.attachmentId}?businessId=${encodeURIComponent(input.businessId)}`,
    { method: "DELETE", credentials: "include" },
  );
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.attachmentId };
}

export async function fetchTaskAttachmentUrl(businessId: string, taskId: string, attachmentId: string) {
  const response = await fetch(
    `/api/business/tasks/${taskId}/attachments/${attachmentId}?businessId=${encodeURIComponent(businessId)}`,
    { credentials: "include", cache: "no-store" },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) return { ok: false as const, url: "", name: "", contentType: "" };
  return { ok: true as const, url: payload.url as string, name: String(payload.name ?? ""), contentType: String(payload.contentType ?? "") };
}

export async function fetchTaskLinks(businessId: string, taskId: string) {
  const response = await fetch(
    `/api/business/tasks/${taskId}/links?businessId=${encodeURIComponent(businessId)}`,
    { credentials: "include", cache: "no-store" },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) return { ok: false as const, links: [] };
  return { ok: true as const, links: payload.links ?? [] };
}

export async function saveTaskLink(input: {
  businessId: string;
  taskId: string;
  linkId?: string;
  title: string;
  url: string;
  description?: string;
}): Promise<BusinessMutationResult> {
  const response = await fetch(
    input.linkId
      ? `/api/business/tasks/${input.taskId}/links/${input.linkId}`
      : `/api/business/tasks/${input.taskId}/links`,
    {
      method: input.linkId ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: input.businessId,
        title: input.title,
        url: input.url,
        description: input.description ?? "",
      }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.linkId || "" };
}

export async function deleteTaskLink(input: {
  businessId: string;
  taskId: string;
  linkId: string;
}): Promise<BusinessMutationResult> {
  const response = await fetch(
    `/api/business/tasks/${input.taskId}/links/${input.linkId}?businessId=${encodeURIComponent(input.businessId)}`,
    { method: "DELETE", credentials: "include" },
  );
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.linkId };
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
  taskIds?: string[];
  projectId?: string | null;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
  allocations?: Array<{ taskId?: string; projectId?: string; target?: string; amount: number }>;
  allowOverpay?: boolean;
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

export async function saveProjectBasePrice(input: {
  businessId: string;
  projectId: string;
  priceBeforeVat: number;
  vatMode?: "EXCLUDING_VAT" | "INCLUDING_VAT";
}): Promise<BusinessMutationResult> {
  const response = await fetch(`/api/business/projects/${input.projectId}/finance`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: input.businessId,
      amount: input.priceBeforeVat,
      priceBeforeVat: input.priceBeforeVat,
      vatMode: input.vatMode,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!response.ok || payload.error) {
    return { ok: false, error: payload.error || "NETWORK", status: response.status };
  }
  return { ok: true, id: payload.id || input.projectId };
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

export async function fetchProjectPayments(businessId: string, projectId: string) {
  const response = await fetch(
    `/api/business/payments?businessId=${encodeURIComponent(businessId)}&projectId=${encodeURIComponent(projectId)}`,
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
