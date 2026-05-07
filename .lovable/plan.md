## מטרה
להוסיף כפתור בפאנל הדוח של הלקוח (`ClientReportPanel`) שפותח בטאב חדש את חשבון המודעות בפייסבוק / גוגל אדס שאליו הדוח מקושר.

## איפה
`src/components/clients/ClientReportPanel.tsx` — בשורת פעולות הכפתורים (ליד "סנכרן ולכוד", "צלם מחדש", "פתח דוח").

## לוגיקה
מזהה חשבון המודעות נשמר כבר ב-`table.integration_settings.ad_account_id` (וגם `ad_account_name`).

לפי `table.integration_type`:
- **facebook_insights / facebook_ecommerce** → `https://business.facebook.com/adsmanager/manage/campaigns?act={ID_ללא_act_}`
  - יש להסיר prefix של `act_` אם קיים ב-id (החשבונות מפייסבוק חוזרים בפורמט `act_123...`).
- **google_ads** → `https://ads.google.com/aw/overview?__e={ID}` (קישור סטנדרטי לחשבון לפי customer id, ללא מקפים).

הכפתור יופיע **רק** אם:
1. `integration_type` הוא facebook/google_ads
2. קיים `ad_account_id` ב-`integration_settings`

תווית: "פתח חשבון מודעות" עם אייקון `ExternalLink`.
פעולה: `window.open(url, "_blank", "noopener,noreferrer")`.

## שינויים
- עדכון בלעדי של `src/components/clients/ClientReportPanel.tsx`:
  - פונקציית עזר `getAdAccountUrl(table)` שמחזירה `string | null`.
  - הוספת `<Button>` מותנה לפני/ליד כפתור "פתח דוח".
