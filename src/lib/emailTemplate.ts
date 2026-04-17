/**
 * Unified branded email template for AFTER LEAD system.
 * Used for sending reports (dashboards, dynamic tables, etc.) by email.
 */

interface EmailTemplateOptions {
  /** Title shown in the header (e.g., "דוח דשבורד", "דוח SEO") */
  title: string;
  /** Subtitle (optional) - typically the client name or report type */
  subtitle?: string;
  /** Optional personal message from the sender (plain text, will be escaped) */
  message?: string;
  /** Optional CTA link to view the full report online */
  ctaUrl?: string;
  /** CTA button label (default: "צפה בדוח המלא") */
  ctaLabel?: string;
  /** Whether an attachment is included in the email */
  hasAttachment?: boolean;
  /** Custom attachment description (default: "הדוח המלא מצורף כקובץ לנוחותך") */
  attachmentNote?: string;
}

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Builds a branded HTML email body matching the AFTER LEAD design system.
 * Uses inline styles for maximum email-client compatibility.
 */
export function buildBrandedEmailHtml(opts: EmailTemplateOptions): string {
  const {
    title,
    subtitle,
    message,
    ctaUrl,
    ctaLabel = "צפה בדוח המלא",
    hasAttachment = false,
    attachmentNote = "הדוח המלא מצורף כקובץ לנוחותך",
  } = opts;

  const safeMessage = message
    ? escapeHtml(message).replace(/\n/g, "<br/>")
    : "";

  // Brand colors (HSL → hex equivalents from index.css design tokens)
  const brandPrimary = "#2563eb"; // primary blue
  const brandPrimaryDark = "#1e40af";
  const bgSoft = "#f8fafc";
  const textMain = "#0f172a";
  const textMuted = "#64748b";
  const border = "#e2e8f0";

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${bgSoft};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;direction:rtl;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${bgSoft};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${brandPrimary} 0%,${brandPrimaryDark} 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">AFTER LEAD</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;font-weight:500;">מערכת ניהול שיווק חכמה</p>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:32px 32px 8px;text-align:right;">
              <h2 style="margin:0;color:${textMain};font-size:20px;font-weight:700;line-height:1.4;">${escapeHtml(title)}</h2>
              ${subtitle ? `<p style="margin:8px 0 0;color:${textMuted};font-size:14px;font-weight:500;">${escapeHtml(subtitle)}</p>` : ""}
            </td>
          </tr>

          <!-- Message -->
          ${safeMessage ? `
          <tr>
            <td style="padding:16px 32px 8px;text-align:right;">
              <div style="color:${textMain};font-size:15px;line-height:1.7;white-space:pre-wrap;">${safeMessage}</div>
            </td>
          </tr>
          ` : ""}

          <!-- Attachment note -->
          ${hasAttachment ? `
          <tr>
            <td style="padding:16px 32px 8px;text-align:right;">
              <div style="background-color:${bgSoft};border-right:3px solid ${brandPrimary};border-radius:6px;padding:12px 16px;">
                <p style="margin:0;color:${textMuted};font-size:14px;line-height:1.5;">
                  📎 ${escapeHtml(attachmentNote)}
                </p>
              </div>
            </td>
          </tr>
          ` : ""}

          <!-- CTA Button -->
          ${ctaUrl ? `
          <tr>
            <td style="padding:24px 32px 8px;text-align:center;">
              <a href="${escapeHtml(ctaUrl)}"
                 style="display:inline-block;background:linear-gradient(135deg,${brandPrimary} 0%,${brandPrimaryDark} 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(37,99,235,0.2);">
                📊 ${escapeHtml(ctaLabel)}
              </a>
            </td>
          </tr>
          ` : ""}

          <!-- Divider -->
          <tr>
            <td style="padding:32px 32px 0;">
              <hr style="border:none;border-top:1px solid ${border};margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;text-align:center;">
              <p style="margin:0;color:${textMuted};font-size:12px;line-height:1.6;">
                נשלח על ידי המערכת
                <strong style="color:${brandPrimaryDark};font-weight:700;">AFTER LEAD</strong>
              </p>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} AFTER LEAD · כל הזכויות שמורות
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
