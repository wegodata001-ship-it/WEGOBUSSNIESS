async function authHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

export async function startTask(businessId: string, taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}/start`, {
    method: "POST",
    credentials: "include",
    headers: await authHeaders(),
    body: JSON.stringify({ businessId }),
  });
  if (!response.ok) {
    throw new Error("START_FAILED");
  }
}

export async function finishTask(businessId: string, taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}/finish`, {
    method: "POST",
    credentials: "include",
    headers: await authHeaders(),
    body: JSON.stringify({ businessId }),
  });
  if (!response.ok) {
    throw new Error("FINISH_FAILED");
  }
}
