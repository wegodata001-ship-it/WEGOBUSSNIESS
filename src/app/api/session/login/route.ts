import { blockedSession, logAuthStage, readySession } from "@/lib/auth/session-response";
import { getFirebaseWebApiKey, missingAdminFirebaseEnv } from "@/lib/env";
import { resolveSessionByUid } from "@/lib/session/resolve-admin";
import type { SessionBlockReason } from "@/types/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void process.env.FIREBASE_WEB_API_KEY;
void process.env.FIREBASE_ADMIN_PROJECT_ID;
void process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
void process.env.FIREBASE_ADMIN_PRIVATE_KEY;

type PasswordSignIn = {
  idToken?: string;
  refreshToken?: string;
  localId?: string;
  error?: { message?: string };
};

function identityReason(message: string): SessionBlockReason | null {
  const code = message.split(":")[0]?.trim() ?? "";
  if (
    code === "INVALID_PASSWORD"
    || code === "EMAIL_NOT_FOUND"
    || code === "INVALID_LOGIN_CREDENTIALS"
    || code === "INVALID_EMAIL"
  ) {
    return "invalid_credentials";
  }
  if (code === "USER_DISABLED") {
    return "inactive_user";
  }
  if (code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
    return "too_many_requests";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
    const email = body?.email?.trim() ?? "";
    const password = body?.password ?? "";
    if (!email || !password) {
      return blockedSession("invalid_credentials");
    }

    const apiKey = getFirebaseWebApiKey();
    if (!apiKey) {
      logAuthStage("AUTH_LOGIN", "missing_api_key", "AUTH_CONFIGURATION_ERROR");
      return blockedSession("unconfigured");
    }

    const tokenResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const tokens = (await tokenResponse.json()) as PasswordSignIn;
    const errorMessage = tokens.error?.message ?? "";

    if (!tokens.idToken || !tokens.localId) {
      const reason = identityReason(errorMessage);
      if (reason) {
        logAuthStage("AUTH_LOGIN", "identity_rejected");
        return blockedSession(reason);
      }
      logAuthStage("AUTH_LOGIN", "identity_toolkit", errorMessage.split(":")[0] || "unknown");
      return blockedSession("internal");
    }

    logAuthStage("AUTH_LOGIN", "firebase token verified");

    const resolved = await resolveSessionByUid(tokens.localId);
    if (resolved.status === "blocked") {
      logAuthStage("AUTH_LOGIN", "membership blocked", resolved.reason);
      return blockedSession(resolved.reason);
    }

    logAuthStage("AUTH_LOGIN", "user resolved");
    logAuthStage("AUTH_LOGIN", "membership resolved");
    logAuthStage("AUTH_LOGIN", "session cookie created");
    return readySession(resolved, { idToken: tokens.idToken, refreshToken: tokens.refreshToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const missing = missingAdminFirebaseEnv();
    logAuthStage(
      "AUTH_LOGIN",
      "session_finalize",
      missing.length ? `missing:${missing.join(",")}` : message.split(":")[0],
    );
    return blockedSession(missing.length ? "unconfigured" : "internal");
  }
}
