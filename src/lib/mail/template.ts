import { MAIL_BRAND, MAIL_BRAND_FOOTER, MAIL_BRAND_TAGLINE } from "@/lib/mail/env";

export type MailRow = { label: string; value: string };

export type MailTemplateInput = {
  locale: "he" | "ar" | "en";
  heading: string;
  intro?: string;
  rows?: MailRow[];
  ctaLabel?: string;
  ctaHref?: string;
  logoUrl?: string | null;
  primaryColor?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderWegoMail(input: MailTemplateInput) {
  const rtl = input.locale === "he" || input.locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const color = input.primaryColor || "#2563EB";
  const rows = (input.rows ?? []).filter((row) => row.value);
  const logo = input.logoUrl && /^https?:\/\//.test(input.logoUrl)
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${MAIL_BRAND}" width="40" height="40" style="display:block;border-radius:10px;" />`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${input.locale}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#F6F8FC;font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
          <tr>
            <td style="background:#0F172A;padding:20px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${logo ? `<td width="48" style="padding-inline-end:12px;">${logo}</td>` : ""}
                  <td style="text-align:${align};">
                    <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.04em;">${MAIL_BRAND}</div>
                    <div style="font-size:12px;color:#94A3B8;margin-top:4px;">${MAIL_BRAND_TAGLINE}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;text-align:${align};">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;color:#0F172A;">${escapeHtml(input.heading)}</h1>
              ${input.intro ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(input.intro).replace(/\n/g, "<br />")}</p>` : ""}
            </td>
          </tr>
          ${rows.length ? `
          <tr>
            <td style="padding:0 24px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E2E8F0;">
                ${rows.map((row) => `
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #F1F5F9;text-align:${align};">
                    <div style="font-size:12px;color:#64748B;margin-bottom:4px;">${escapeHtml(row.label)}</div>
                    <div style="font-size:15px;color:#0F172A;font-weight:600;">${escapeHtml(row.value)}</div>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>` : ""}
          ${input.ctaHref && input.ctaLabel ? `
          <tr>
            <td style="padding:20px 24px 28px;text-align:${align};">
              <a href="${escapeHtml(input.ctaHref)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-size:14px;font-weight:700;">
                ${escapeHtml(input.ctaLabel)}
              </a>
            </td>
          </tr>` : ""}
          <tr>
            <td style="background:#F8FAFC;padding:16px 24px;border-top:1px solid #E2E8F0;text-align:${align};">
              <div style="font-size:13px;font-weight:700;color:#0F172A;">${MAIL_BRAND}</div>
              <div style="font-size:12px;color:#64748B;margin-top:2px;">${MAIL_BRAND_FOOTER}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    MAIL_BRAND,
    MAIL_BRAND_TAGLINE,
    "",
    input.heading,
    input.intro ?? "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    input.ctaHref ? `${input.ctaLabel ?? ""}: ${input.ctaHref}` : "",
    "",
    MAIL_BRAND,
    MAIL_BRAND_FOOTER,
  ].filter((line) => line !== "").join("\n");

  return { html, text };
}
