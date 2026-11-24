/**
 * Password reset via Firebase Identity Toolkit (same stack as /api/session/login).
 * Always treat the outcome as opaque to callers to avoid email enumeration.
 */

export type PasswordResetRequest = {
  email: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
};

export type PasswordResetOutcome = {
  /** Public result — always true after a well-formed request was attempted. */
  accepted: true;
  /** Internal only for tests/logs — never return to the browser. */
  toolkitOk: boolean;
  toolkitCode: string;
};

export function normalizeResetEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidResetEmail(email: string) {
  const value = normalizeResetEmail(email);
  return Boolean(value) && value.includes("@") && !value.includes(" ");
}

export async function requestPasswordReset(input: PasswordResetRequest): Promise<PasswordResetOutcome> {
  const email = normalizeResetEmail(input.email);
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
      }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    email?: string;
    error?: { message?: string };
  };
  const toolkitCode = payload.error?.message?.split(":")[0]?.trim() || (response.ok ? "OK" : "UNKNOWN");
  return {
    accepted: true,
    toolkitOk: response.ok && !payload.error,
    toolkitCode,
  };
}
