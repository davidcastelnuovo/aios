export function generateInvitationEmailHTML(
  fullName: string,
  roleName: string,
  invitationLink: string
): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>הזמנה למערכת ניהול סוכנויות</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); margin: 0 auto;">
          <!-- Logo Section -->
          <tr>
            <td align="center" style="padding: 32px 0;">
              <img src="https://after-lead.lovable.app/logo.png" alt="לוגו מערכת ניהול סוכנויות" width="80" height="80" style="display: block; margin: 0 auto;">
            </td>
          </tr>
          
          <!-- Heading -->
          <tr>
            <td align="center" style="padding: 0 48px;">
              <h1 style="color: #1a1a1a; font-size: 28px; font-weight: bold; margin: 40px 0; text-align: center;">
                שלום ${fullName || 'משתמש חדש'}!
              </h1>
            </td>
          </tr>
          
          <!-- Main Text -->
          <tr>
            <td style="padding: 0 48px;">
              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 16px 0; text-align: right;">
                הוזמנת להצטרף למערכת ניהול סוכנויות בתפקיד <strong>${roleName}</strong>.
              </p>
            </td>
          </tr>
          
          <!-- Button -->
          <tr>
            <td align="center" style="padding: 24px 48px;">
              <a href="${invitationLink}" target="_blank" style="background-color: #0066ff; border-radius: 6px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block; padding: 12px 32px;">
                הצטרף למערכת
              </a>
            </td>
          </tr>
          
          <!-- Link Text -->
          <tr>
            <td style="padding: 0 48px;">
              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 16px 0; text-align: right;">
                או העתק והדבק את הקישור הבא בדפדפן שלך:
              </p>
            </td>
          </tr>
          
          <!-- Link Box -->
          <tr>
            <td style="padding: 0 48px;">
              <div style="color: #666; font-size: 14px; line-height: 24px; margin: 16px 0; padding: 12px; background-color: #f4f4f4; border-radius: 4px; word-break: break-all; direction: ltr; text-align: left;">
                ${invitationLink}
              </div>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 48px;">
              <hr style="border: none; border-top: 1px solid #e6e6e6; margin: 32px 0;">
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 0 48px;">
              <p style="color: #898989; font-size: 12px; line-height: 22px; margin: 16px 0; text-align: center;">
                אם לא ביקשת להצטרף למערכת, אתה יכול להתעלם מאימייל זה.
              </p>
            </td>
          </tr>
          
          <tr>
            <td align="center" style="padding: 0 48px 32px;">
              <p style="color: #898989; font-size: 12px; line-height: 22px; margin: 16px 0; text-align: center;">
                מערכת ניהול סוכנויות © ${new Date().getFullYear()}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
