## מטרה
להריץ בדיקה מלאה end-to-end שתשלח לך הודעת WhatsApp אמיתית עם סיכום הממצאים — בדיוק כמו שכרמן תשלח בפרודקשן.

## מה יקרה

1. **הוספת מימוש `notify=true` ל-`test-campaign-monitor`**:
   - אחרי איסוף הדוח (anomalies + billing issues), לבנות הודעת WhatsApp מסודרת בעברית עם:
     - סה"כ דוחות שנסרקו (Facebook Insights / Ecommerce / Google Ads)
     - רשימת חשבונות עם בעיית חיוב (שם לקוח + ad_account_id + סטטוס)
     - רשימת קמפיינים שעצרו בפועל (top 10 anomalies אחרונים)
   - שליחה ישירה אליך דרך `send-green-api-message` עם הקבועים `DAVID_PHONE` / `DAVID_GREEN_API_TENANT` / `DAVID_GREEN_API_USER` (אותו דפוס כמו ב-`cron-sync-facebook-insights`).

2. **הרצת הפונקציה** עם `{"notify": true}` — תרוץ סנכרון מלא של פייסבוק ו-Google Ads, ואחר כך תשלח לך WhatsApp.

3. **אימות**: לבדוק בלוגים של `send-green-api-message` שההודעה אכן נשלחה, ולהציג כאן את גוף ההודעה ששלחנו.

## קבצים שייגעו
- `supabase/functions/test-campaign-monitor/index.ts` — הוספת בלוק notify

## מה לא בתכנית
- לא משנים את ה-cron עצמו (הוא כבר שולח לך התראות אוטומטית בכל ריצה אם הוא מזהה anomaly).
- לא בונים UI.
