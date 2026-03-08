

# תוכנית: תיקון סוכן AI + ניהול שיחות

## בעיות שזוהו

1. **הסוכן נתקע** — אחרי הרצת tool call, תגובת ה-AI עלולה להכיל tool call נוסף (למשל שוב `list_tasks`), אבל הקוד מטפל רק ברמה אחת של tool calls. התוצאה: הסוכן כותב "שולף משימות" שוב ושוב בלי לסיים.

2. **חסרה אפשרות מחיקת שיחות**

3. **חסרה מתן שם אוטומטי לשיחה** — כרגע השם הוא 50 תווים ראשונים מההודעה הראשונה

## שינויים

### 1. Edge Function — תמיכה ב-recursive tool calls (עד 3 רמות)
**קובץ:** `supabase/functions/ai-support-chat/index.ts`

- אחרי הרצת tool call ושליחת follow-up ל-AI, לבדוק אם התגובה מכילה tool call נוסף ולהריץ אותו (עד 3 סבבים)
- מניעת לולאה אינסופית עם מגבלת MAX_TOOL_ROUNDS = 3

### 2. Edge Function — שם שיחה אוטומטי מ-AI
**קובץ:** `supabase/functions/ai-support-chat/index.ts`

- אחרי שמירת שיחה חדשה, קריאה נוספת ל-AI Gateway (non-streaming, מודל מהיר) עם בקשה לסכם את נושא השיחה ב-5 מילים
- עדכון ה-title בטבלה

### 3. UI — מחיקת שיחות + שם שיחה
**קובץ:** `src/pages/AISupport.tsx`

- **מחיקה:** הוספת כפתור מחיקה (אייקון פח) ליד כל שיחה בסיידבר, עם dialog אישור
- **שם שיחה:** הצגת השם שנוצר אוטומטית (כבר מוצג, רק צריך לתמוך בשם ארוך יותר)
- **שיחה חדשה:** הכפתור כבר קיים — נוודא שהוא בולט

### קבצים לשינוי
1. `supabase/functions/ai-support-chat/index.ts` — recursive tool calls + auto-title
2. `src/pages/AISupport.tsx` — מחיקת שיחות, עדכון UI

