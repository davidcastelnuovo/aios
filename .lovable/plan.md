## בדיקת השינויים שדחפת דרך הרמס

עברתי על שלושת הקבצים שנגעו ב-PR #14 (Carmen V2 prompt):

| קובץ | מצב |
|---|---|
| `supabase/functions/_shared/carmen-prompt-v2.ts` (חדש, 514 שורות) | ✅ תקין, עובר `deno check` |
| `src/components/agents/tabs/ProfileTab.tsx` | ✅ תקין — סלקטור V1/V2 נשמר ב-`metadata.prompt_version` ועובר דרך `save.mutate()` הקיים |
| `supabase/functions/run-ai-agent/index.ts` | 🔴 **שבור — שגיאת תחביר** |

## הבעיה הקריטית

בעריכה של `run-ai-agent/index.ts` נוסף `} else {` בשורה 1599 שפותח את ענף V1, אבל **לא נסגר**. `deno check` נופל:

```
error: Expression expected at index.ts:2055:2
  })
```

המשמעות: ה-Edge Function לא יעלה לפרודקשן. אם תפרסי deploy עכשיו — כרמן תפסיק לעבוד לגמרי (לא רק V2). ב-build הנוכחי בסביבה זה עדיין עובד רק כי הפונקציה הקיימת בענן מהקומיט הקודם.

## גם בעיית כפילות (לא קריטית)

ה-V2 builder כבר בונה בעצמו: תאריך, הקשר ארגוני, זיכרון, סקילז, סגנון כתיבה, אורך תשובה. אבל הקוד מ-1626 ואילך (`task_mode`, `task_skills`, `writing_style`, `response_length`, date/tenant/memory injection) רץ ללא תנאי וגם ב-V2 — ולכן ב-V2 כל הסעיפים האלה יופיעו פעמיים בתוך ה-system prompt. עובד טכנית, אבל מנפח את הפרומפט וגורם להוראות סותרות פוטנציאלית.

## תיקון מוצע

### A. סגירת ה-`else` (קריטי, חובה לפני deploy)
להוסיף `}` חסר ב-`run-ai-agent/index.ts` כדי שה-`else { ... V1 ... }` ייסגר נכון, ולהחזיר את כל בלוקי ה-injection (`task_mode`, `task_skills`, writing/length, date, tenant, memory, knowledge base, behavior rules) **לתוך** ענף ה-V1 בלבד.

המיקום: לעטוף את שורות 1601–~1900 בתוך `else`, ולסגור אותו לפני הקטעים שצריכים לרוץ עבור שני המסלולים (אם יש כאלה — אחרת לסגור ממש לפני שינוי ה-systemPrompt משתנה לקוד הבא במסלול).

### B. אימות פוסט-תיקון
- להריץ `deno check supabase/functions/run-ai-agent/index.ts` — חייב לעבור.
- לפרוס מחדש את `run-ai-agent` ולוודא שכרמן מגיבה כרגיל ב-V1 (ברירת מחדל).
- לעבור ידנית ל-Agent Profile → Runtime → "גרסת Prompt" = V2, ולשלוח הודעה אחת לכרמן כדי לוודא שמסלול V2 עובד.

### C. DB — אין צורך בעדכון
- העמודה `metadata jsonb` כבר קיימת בטבלה `ai_agents`.
- לא צריך מיגרציה, לא צריך RLS חדש, לא צריך GRANT.

## טכני קצר

- קובץ יחיד לתיקון: `supabase/functions/run-ai-agent/index.ts` (סוגריים בלבד, 1 שורה).
- אין שינוי DB.
- אין שינוי לוגיקה ב-V2 builder או ב-UI.

מאשר שאעבור למוד build ואתקן?