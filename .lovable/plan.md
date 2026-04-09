

## תוכנית: איחוד דיאלוגי עדכון תקשורת + זיהוי סטטוסים בכרמן

### הבעיה
1. יש שני מקומות שונים לעדכון מצב תקשורת: אחד inline ב-`ClientUpdatesTab` ואחד ב-`CommunicationUpdateModal` — כפילות מיותרת.
2. כרמן משתמשת במונחים `happy/wavering/churn_risk` אבל לא מכירה את המונחים העבריים "תלונה" ו"רגיש" שהמשתמש רואה בממשק.

### הפתרון

**1. איחוד הדיאלוגים**
- הסרת ה-`CommunicationUpdateModal` הנפרד (קובץ שלם)
- שימוש בסקשן ה-inline שב-`ClientUpdatesTab` בלבד כממשק היחיד לעדכון מצב תקשורת
- עדכון כל המקומות שפותחים את `CommunicationUpdateModal` כדי שיפנו לטאב "עדכונים" במקום

**2. עדכון System Prompt של כרמן**
- הוספת מיפוי מפורש בהנחיות: "תלונה" = complaint = churn_risk, "רגיש" = sensitive = wavering, "תקין" = normal = happy
- כשמשתמש אומר "תעדכני את בריפלקט ל-תלונה" או "הלקוח רגיש", כרמן תדע לקרוא ל-`update_client_health` עם הערכים המתאימים

### שלבי ביצוע

1. **עדכון System Prompt** ב-`ai-support-chat/index.ts` — הוספת פסקת הנחיות שממפה בין המונחים העבריים (תקין/רגיש/תלונה) לערכי ה-API (`mood_status` + `communication_status`)

2. **עדכון כלי `update_client_health`** — הוספת enum description בעברית כך שכרמן תבין: `happy=תקין, wavering=רגיש, churn_risk=תלונה`

3. **הסרת `CommunicationUpdateModal`** — מחיקת הקובץ `src/components/clients/CommunicationUpdateModal.tsx`

4. **עדכון ייבואים** — הסרת כל ההפניות ל-`CommunicationUpdateModal` בקבצים שמשתמשים בו (צריך לבדוק היכן הוא נפתח)

### קבצים שישתנו
- `supabase/functions/ai-support-chat/index.ts` — system prompt + tool description
- `src/components/clients/CommunicationUpdateModal.tsx` — מחיקה
- קבצים שמייבאים את המודל (צריך בדיקה)

