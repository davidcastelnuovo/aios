# מפת אתר ויזואלית

אצור דיאגרמת Mermaid אינטראקטיבית של כל המודולים במערכת, מחולקת לפי קטגוריות תפריט, ואשמור אותה כ-artifact שתוכל לפתוח ולהוריד.

## מה הדיאגרמה תכלול

עץ היררכי עם 6 ענפים ראשיים:

1. **ניהול** — Dashboard, Tenants, Agencies, Users, Suppliers, Accounting
2. **מכירות** — Sales Dashboard, Leads, Sales People, Products, Time Tracking, Lead Integrations
3. **תקשורת** — Chat, Team Chat, Social Media (Gantt/Visual), Recordings, Dynamic Tables, AI Detection, Gmail, Signatures, Integrations
4. **אוטומציה ו-AI** — Automations, Campaign Alerts, Social Publisher, Agents, Carmen Insights, Visual Workspace
5. **הגדרות** — My Profile, Branding, Menu Management, Fields Management, AI Support
6. **אינטגרציות** — ManyChat, Green API, Telegram, Facebook, Google Ads, TikTok, GA, GSC, Ahrefs, SerpAPI, Make, Zoom, Manus, Telephony, Maskyoo, WordPress, Unified.to, Accounting, GitHub Agent

לכל מודול אציין את ה-route המלא (`/t/:tenantSlug/...`).

## פורמט

קובץ `.mmd` ב-`/mnt/documents/sitemap.mmd` שיוצג כדיאגרמה אינטראקטיבית עם תמיכה במצב כהה/בהיר.

## אופציות נוספות (תגיד לי אם רוצה)

- להוסיף ציון הרשאה נדרשת לכל מודול (super_admin / owner / campaigner וכו׳)
- לפצל לכמה דיאגרמות נפרדות (אחת לכל קטגוריה) אם זה גדול מדי
- גרסת PDF מעוצבת במקום Mermaid
