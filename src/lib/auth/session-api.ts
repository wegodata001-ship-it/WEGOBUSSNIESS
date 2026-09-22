export async function persistAuthPresence() {
  await fetch("/api/session", { method: "POST" });
}

export async function clearAuthPresence() {
  await fetch("/api/session", { method: "DELETE" });
}
