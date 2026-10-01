import "server-only";
import { mailConfig } from "@/lib/mail/env";

export type BrevoReason =
  | "IP_ALLOWLIST"
  | "SENDER_NOT_VERIFIED"
  | "AUTH_FAILED"
  | "MAIL_NOT_CONFIGURED"
  | "WEGO_EMAIL_SENDER_NOT_CONFIGURED"
  | "INVALID_RECIPIENT"
  | "MAIL_SEND_FAILED";

export type BrevoProbe = {
  ok: boolean;
  status: number;
  code: string;
  message: string;
  reason: BrevoReason;
  senders: Array<{ email: string; name: string; active: boolean }>;
};

function classify(status: number, code: string, message: string): BrevoReason {
  const text = `${code} ${message}`.toLowerCase();
  if (text.includes("authorised_ip") || text.includes("authorized_ip") || text.includes("unrecognised ip") || text.includes("unrecognized ip")) {
    return "IP_ALLOWLIST";
  }
  if (status === 401 || text.includes("unauthorized") || text.includes("unrecognised ip")) {
    if (text.includes("ip")) return "IP_ALLOWLIST";
    return "AUTH_FAILED";
  }
  if (text.includes("sender") && (text.includes("not verified") || text.includes("invalid") || text.includes("not found"))) {
    return "SENDER_NOT_VERIFIED";
  }
  return "MAIL_SEND_FAILED";
}

export async function brevoRequest(path: string, init?: RequestInit) {
  const config = mailConfig();
  if (!config.apiKey) {
    return {
      ok: false,
      status: 0,
      payload: {} as Record<string, unknown>,
      reason: "MAIL_NOT_CONFIGURED" as BrevoReason,
      code: "MAIL_NOT_CONFIGURED",
      message: "BREVO_API_KEY missing",
    };
  }
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": config.apiKey,
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const message = typeof payload.message === "string"
    ? payload.message
    : typeof (payload.error as { message?: string } | undefined)?.message === "string"
      ? (payload.error as { message: string }).message
      : "";
  const code = typeof payload.code === "string" ? payload.code : "";
  return {
    ok: response.ok,
    status: response.status,
    payload,
    reason: classify(response.status, code, message),
    code,
    message,
  };
}

export async function probeBrevo(): Promise<BrevoProbe> {
  const account = await brevoRequest("/account");
  if (!account.ok) {
    return {
      ok: false,
      status: account.status,
      code: account.code,
      message: account.message,
      reason: account.reason,
      senders: [],
    };
  }
  const senders = await brevoRequest("/senders");
  const list = Array.isArray(senders.payload.senders)
    ? (senders.payload.senders as Array<{ email?: string; name?: string; active?: boolean }>)
      .filter((item) => typeof item.email === "string")
      .map((item) => ({
        email: item.email as string,
        name: typeof item.name === "string" ? item.name : "",
        active: item.active !== false,
      }))
    : [];
  return {
    ok: senders.ok,
    status: senders.status || account.status,
    code: senders.code,
    message: senders.message,
    reason: senders.ok ? "MAIL_SEND_FAILED" : senders.reason,
    senders: list,
  };
}

const WEGO_SENDERS = ["email@wegobiz.app", "wego.biz24@gmail.com"];

export function wegoSenderFromList(senders: Array<{ email: string; active: boolean }>) {
  for (const wanted of WEGO_SENDERS) {
    const found = senders.find((item) => item.email.toLowerCase() === wanted && item.active);
    if (found) return found;
  }
  return senders.find((item) => /wego/i.test(item.email) && !/mishkah|mishkat/i.test(item.email) && item.active) ?? null;
}
