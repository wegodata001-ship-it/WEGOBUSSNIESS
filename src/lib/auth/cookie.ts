import { clearAuthPresence, persistAuthPresence } from "@/lib/auth/session-api";

export async function setAuthPresenceCookie() {
  await persistAuthPresence();
}

export async function clearAuthPresenceCookie() {
  await clearAuthPresence();
}
