
## תיקון ספירת לידים של WhatsApp/Messenger בדוח Facebook

### הבעיה
בדוח של "א.י זוהר עץ" קמפיינים שמייצרים שיחות WhatsApp/Messenger מציגים **0 לידים**, כי:
1. הקמפיינים הם מסוג `OUTCOME_ENGAGEMENT` (Click-to-WhatsApp) ולא `OUTCOME_LEADS`.
2. הסנכרון לא מבקש מפייסבוק את ה-attribution windows הנכונים, כך שאירועי `messaging_conversation_started_7d` לא חוזרים ב-`actions`.
3. גם אם חזרו — הקמפיינים האלו מסווגים כ-`other` ולא כ-`lead`, כך שעמודת הלידים נשארת 0.

### מה אתקן (ממוקד, בלי לגעת ב-E-commerce / Lead Forms קיימים)

#### `supabase/functions/sync-facebook-insights/index.ts`
שינוי מינימלי וממוקד:

1. **בקשת Insights API** — אוסיף:
   - `action_attribution_windows=['7d_click','1d_view']`
   - `use_unified_attribution_setting=true`
   
   זה חושף את אירועי ה-messaging בלי לשנות את שאר הנתונים (spend, impressions, purchases וכו').

2. **חישוב לידים** — אוסיף מקור ליד נוסף בצד המקורות הקיימים:
   - סכום של `onsite_conversion.messaging_conversation_started_7d` + הגרסה ה-bare `messaging_conversation_started_7d`
   - אם סוג הקמפיין הוא `OUTCOME_ENGAGEMENT` / `MESSAGES` ויש אירועי messaging → יסווג כ-`lead` (במקום `other`).
   - לקמפיינים של Lead Forms (`OUTCOME_LEADS`) הלוגיקה הקיימת של `leadgen_grouped` לא משתנה.
   - לקמפיינים של E-commerce (`OUTCOME_SALES`) שום דבר לא משתנה — purchases ממשיכים לעבוד כמו שהם.

3. **מניעת ספירה כפולה** — ניקח `MAX` בין ה-aggregate `lead` שפייסבוק מחזיר לבין סכום האירועים הספציפיים, כדי שקמפיין מעורב (Lead Form + Messaging) לא יספר פעמיים.

### מה לא משתנה
- טבלת `facebook_ecommerce` ומסלול ה-E-commerce
- חישוב spend, impressions, clicks, CTR, CPC
- קמפיינים מסוג Lead Form רגילים
- UI של הטבלה (`SharedTable` / הדשבורד) — האגרגציה ב-frontend כבר יודעת לסכם `leads`

### בדיקות
- קמפיין WhatsApp של "א.י זוהר עץ" → לידים > 0, CPL מחושב
- קמפיין Lead Form רגיל → ממשיך לעבוד כרגיל
- קמפיין E-commerce → ללא שינוי
- קמפיין מעורב → ללא ספירה כפולה

### הערה
לאחר הפריסה יש להריץ **סנכרון ידני של Facebook** כדי למשוך מחדש נתונים היסטוריים עם ה-attribution windows החדשים.

### קובץ לעדכון
- `supabase/functions/sync-facebook-insights/index.ts`
