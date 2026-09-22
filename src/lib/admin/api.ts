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
