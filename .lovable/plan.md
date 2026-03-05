

## אבחון

ההקלטה (`6315c5a7`) תקועה בסטטוס `processing` בבסיס הנתונים. הלוגים מראים שהפונקציה הגיעה לשלב "Transcribing audio directly..." (קריאה ל-Whisper עם קובץ 22MB) אבל אין לוג של הצלחה או כישלון — כלומר הפונקציה קרסה (wall-clock timeout של Edge Function, בערך 150 שניות) לפני שהספיקה לעדכן את הסטטוס ב-DB.

כתוצאה:
- הסטטוס נשאר `processing` לנצח
- הפולינג בצד הלקוח ממשיך לבדוק כל 5 שניות ולא מוצא שינוי
- המשתמש לא מקבל תשובה

## תוכנית תיקון

### 1. Stale processing detection (client-side)
**קובץ:** `src/components/SummarizeRecordingDialog.tsx`

- בלוגיקת הפולינג, לבדוק גם את `updated_at` של ההקלטה
- אם `transcription_status === 'processing'` וחלפו יותר מ-5 דקות מ-`updated_at`, להניח שהפונקציה קרסה
- להציג למשתמש הודעה: "נראה שהתמלול נתקע, נסה שוב" ולאפס את הסטטוס

### 2. Wall-clock timeout guard (edge function)
**קובץ:** `supabase/functions/transcribe-recording/index.ts`

- להוסיף `AbortController` עם timeout של 120 שניות על קריאת Whisper
- אם חורג — לעדכן `transcription_status = 'failed'` ב-DB **לפני** הקריסה
- כך הפולינג בצד הלקוח יזהה כישלון במקום processing תקוע

### 3. Reset stale status
**Migration:** עדכון חד-פעמי לנקות את ההקלטה התקועה

```sql
UPDATE zoom_recordings 
SET transcription_status = 'failed', 
    transcription_error = 'Edge function timed out'
WHERE transcription_status = 'processing' 
  AND updated_at < NOW() - INTERVAL '5 minutes';
```

### 4. Retry mechanism
- אחרי זיהוי timeout/כישלון, לאפשר למשתמש ללחוץ "נסה שוב" שיאפס את הסטטוס ויקרא שוב לפונקציה

### קבצים לשינוי
- `supabase/functions/transcribe-recording/index.ts` — AbortController + timeout guard
- `src/components/SummarizeRecordingDialog.tsx` — stale detection + retry UX
- Migration — ניקוי הקלטות תקועות

