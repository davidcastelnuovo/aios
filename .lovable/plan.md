

# תיקון: כרמן לא מסיימת משימות ארוכות + אנימציה לא נראית

## בעיות שזוהו

### 1. Timeout של Edge Function
ל-`ai-support-chat` אין הגדרת timeout מיוחדת ב-`config.toml`. ברירת המחדל היא **60 שניות**. עם 75 לקוחות, גם עם batch, לולאת ה-AI (tool call → AI response → tool call) יכולה לקחת הרבה יותר. כשה-timeout קורה, ה-stream נקטע **בלי הודעת שגיאה** — כרמן פשוט נעלמת.

### 2. הקליינט לא מזהה ניתוק
ב-`AIOSDialog.tsx`, `setIsStreaming(false)` קורה רק כש:
- מתקבל `type: 'done'` (שורה 200)
- נתפס exception (שורה 215)

אם ה-stream נקטע ע"י timeout, `reader.read()` מחזיר `done: true` בלי שנשלח `type: 'done'` — הלולאה נגמרת, **אבל `isStreaming` נשאר `true`** וכרמן "תקועה" לנצח.

### 3. שגיאת DB בלוג
`PGRST116 - Cannot coerce result to single JSON object` — כנראה מקריאת `.single()` בפונקציות כמו `create_facebook_report_table` או `create_google_ads_table` כש-client_id לא נמצא.

### 4. הגלואו קטן מדי
`box-shadow` של `4px`/`8px` עם opacity 0.3/0.15 כמעט לא נראה על רקע כהה.

---

## התיקון

### חלק 1: הגדלת Timeout ל-300 שניות
**קובץ: `supabase/config.toml`**
- הוספת בלוק לפונקציה עם הגדלת timeout (שימוש ב-`wall_clock_limit_sec = 300`)

### חלק 2: תיקון זיהוי ניתוק בצד הקליינט
**קובץ: `src/components/AIOSDialog.tsx`**
- אחרי שלולאת `while (true)` נגמרת (reader done), אם `isStreaming` עדיין true — כלומר לא התקבל `type: 'done'` — נסיים את ה-streaming בכוח
- נוסיף הודעה למשתמש: אם היה assistantContent חלקי — נציג אותו. אם לא — נציג הודעת שגיאה "הפעולה הופסקה"
- אותו דבר ב-`AIOSContext.tsx` (לגרסת ה-AIOS mode)

### חלק 3: חיזוק אנימציית הזוהר
**קובץ: `tailwind.config.ts`**
- הגדלת ה-spread ל-`12px`/`20px`
- הגברת opacity ל-`0.6`/`0.4`
- הוספת `ring` צבע emerald-400 בנוסף ל-box-shadow

### חלק 4: הוספת אינדיקציית "כרמן עובדת" בתוך הדיאלוג
**קובץ: `src/components/AIOSDialog.tsx`**
- כשהדיאלוג פתוח וכרמן עובדת, הוספת אנימציית glow לאווטאר שלה בהדר של הדיאלוג

### חלק 5: תיקון שגיאת PGRST116
**קובץ: `supabase/functions/ai-support-chat/index.ts`**
- שינוי קריאות `.single()` ל-`.maybeSingle()` במקומות שעלולים להחזיר 0 שורות (בעיקר בשליפת לקוח)

---

## קבצים לעריכה
- `supabase/config.toml` — timeout
- `src/components/AIOSDialog.tsx` — זיהוי ניתוק + glow בדיאלוג
- `src/contexts/AIOSContext.tsx` — זיהוי ניתוק (AIOS mode)
- `tailwind.config.ts` — חיזוק glow
- `supabase/functions/ai-support-chat/index.ts` — `.maybeSingle()` תיקון

