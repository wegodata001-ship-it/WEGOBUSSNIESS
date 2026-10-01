import "server-only";

export const MAIL_BRAND = "WEGO BIZ";
export const MAIL_BRAND_TAGLINE = "Business Management";
export const MAIL_BRAND_FOOTER = "Business Management System";

export function mailConfig() {
  return {
    provider: (process.env.MAIL_PROVIDER ?? "BREVO").trim(),
    baseUrl: (process.env.BREVO_BASE_URL ?? "https://api.brevo.com/v3").trim().replace(/\/$/, ""),
    apiKey: (process.env.BREVO_API_KEY ?? "").trim(),
    senderName: (process.env.BREVO_SENDER_NAME ?? MAIL_BRAND).trim() || MAIL_BRAND,
    senderEmail: (process.env.BREVO_SENDER_EMAIL ?? "").trim(),
    replyTo: (process.env.BREVO_REPLY_TO ?? process.env.WEGO_ADMIN_EMAIL ?? "").trim(),
    adminEmail: (process.env.WEGO_ADMIN_EMAIL ?? "").trim(),
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, ""),
  };
}

export function siteHref(path: string) {
  const config = mailConfig();
  const clean = path.startsWith("/") ? path : `/${path}`;
  return config.siteUrl ? `${config.siteUrl}${clean}` : clean;
}

export function isMailConfigured() {
  const config = mailConfig();
  return Boolean(config.apiKey && config.senderEmail && config.provider === "BREVO");
}
