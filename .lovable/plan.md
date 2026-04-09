

## הבעיה: כלי עדכון דשבורד CRM חסרים ב-AIOS

כרמן דרך ממשק ה-AIOS (`ai-support-chat`) **לא מכילה** את הכלים הבאים שקיימים רק ב-`run-ai-agent`:
- `analyze_campaign_performance` — ניתוח ביצועי קמפיינים (השוואת 7 ימים מול 30 יום)
- `update_client_health` — עדכון mood_status, health score ויצירת רשומת communication_logs

לכן כרמן יכולה לקרוא נתונים מטבלאות דינמיות (`get_table_data`) ולהציג דוח, אבל **לא יכולה לעדכן** את הדשבורד.

## הפתרון

הוספת שני הכלים ל-`supabase/functions/ai-support-chat/index.ts`:

### 1. הוספת כלי `analyze_campaign_performance` (tool definition + handler)
- **הגדרת הכלי**: עם פרמטר אופציונלי `client_id`
- **Handler**: העתקת הלוגיקה מ-`run-ai-agent` — שליפת CRM tables מסוג facebook, השוואת ממוצעי 7 ימים מול 30 יום (spend, CPL, ROAS), חישוב אחוזי שינוי

### 2. הוספת כלי `update_client_health` (tool definition + handler)
- **הגדרת הכלי**: עם `client_id`, `mood_status` (happy/wavering/churn_risk), `communication_status`, `note`
- **Handler**: העתקת הלוגיקה מ-`run-ai-agent`:
  1. עדכון `mood_status` בטבלת `clients`
  2. יצירת רשומה ב-`communication_logs` עם `interaction_type: system_alert`
  3. יצירת רשומה ב-`client_updates` עם prefix `[עדכון אוטומטי - כרמן]`
  4. שימוש ב-owner כ-fallback user ID

### 3. עדכון System Prompt
- הוספת סעיפים 21-22 לרשימת הפעולות: "ניתוח קמפיינים" ו-"עדכון בריאות לקוח בדשבורד CRM"

### פרטים טכניים
- **קובץ**: `supabase/functions/ai-support-chat/index.ts`
- הלוגיקה תועתק מ-`run-ai-agent/index.ts` (שורות 323-457) עם התאמות ל-context של ai-support-chat (userId מהאימות, tenantId מה-resolution הקיים)

