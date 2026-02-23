
# הוספת tenant_slug אוטומטית ל-Webhook URL

## הבעיה
כרגע ה-Webhook URL שמוצג בדף האינטגרציות לא כולל את ה-`tenant_slug`, ולכן לידים שנשלחים מוויקס (או כל מקור חיצוני) בלי `tenant_slug` בגוף ה-JSON לא נקלטים.

## הפתרון - שני שינויים:

### 1. Edge Function: תמיכה ב-tenant_slug כ-query parameter
**קובץ:** `supabase/functions/webhook-lead-intake/index.ts`

- לקרוא `tenant_slug` גם מה-URL query params (נוסף על הגוף)
- אם `tenant_slug` לא קיים ב-body, לחפש אותו ב-`?tenant_slug=...`
- זה מאפשר שטפסי Wix וכדומה ישלחו ל-URL עם ה-slug בלי צורך לשנות את ה-body

### 2. Frontend: הצגת URL עם tenant_slug
**קובץ:** `src/pages/LeadIntegrations.tsx`

- לשנות את `webhookUrl` לכלול `?tenant_slug=SLUG` אוטומטית
- כל המקומות שמציגים את ה-URL (ה-Alert למעלה, דוגמאות Make/Zapier, דוגמת cURL) יציגו את ה-URL המלא
- דוגמאות ה-JSON עדיין יכללו את `tenant_slug` בגוף כגיבוי

### תוצאה צפויה
- המשתמש מעתיק URL מוכן לשימוש עם ה-tenant_slug כבר בתוכו
- טפסי Wix ומקורות אחרים שלא שולחים tenant_slug בגוף ה-JSON יעבדו אוטומטית
- תאימות לאחור מלאה - מי ששולח tenant_slug בגוף עדיין יעבוד
