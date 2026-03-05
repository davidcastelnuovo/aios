
אבחון חד וברור: כן, יש לנו יכולת תמלול — אבל כרגע יש 2 תקלות קוד שחוסמות את הזרימה בפועל, ולכן זה נראה כאילו “אין יכולת”.

1) מה מצאתי בפועל
- ההקלטות קיימות בדאטה של tenant `marketingcaptain` (לא חסרות מהמערכת).
- אין אף תמלול שהושלם; יש `failed` אחד ויתר הרשומות ללא סטטוס.
- הקלטות רבות הן Audio בגודל גדול (למשל ~42MB, ~58MB), וזה אמור לעבור למסלול chunking — אבל המסלול הזה שבור כרגע.

2) שורש הבעיה (Root Cause)
- בקובץ `supabase/functions/transcribe-recording/index.ts`, מצב `mode='download'` מחזיר שגיאת `file_too_large` מעל 25MB.
- זה בדיוק המסלול שאמור לאפשר chunking בצד לקוח לקבצים גדולים — ולכן התהליך נתקע לוגית.
- בנוסף, `supabase/functions/transcribe-voice/index.ts` מריץ Whisper + תיקון GPT על כל chunk, בלי guard מסודר של timeout; זה מאריך זמן ומגדיל סיכון לכשל.
- יש גם בלבול tenant/URL אצלך בסשן (`/t/podcast-studio/recordings`), ולכן לפעמים נראה כאילו “אין נתונים/לא עובד”, למרות שהחומר ב-MarketingCaptain.

3) תוכנית תיקון (Implementation)
א. תיקון מסלול קבצים גדולים (קריטי)
- `supabase/functions/transcribe-recording/index.ts`
  - להסיר את החסימה ב-`mode='download'` עבור >25MB.
  - `mode='download'` יחזיר payload להמשך chunking במקום `file_too_large`.
  - להחזיר גם metadata ברור: `source_recording_type`, `size_mb`, `used_fallback`.

ב. הקשחת תמלול chunk
- `supabase/functions/transcribe-voice/index.ts`
  - להוסיף `AbortController` (למשל 120s) לקריאת Whisper.
  - לבטל תיקון GPT לכל chunk (או להפוך לאופציונלי כבוי כברירת מחדל) כדי למנוע זמן ריצה מיותר.
  - לשמור CORS headers מלאים ותואמים לכל תגובה (כולל שגיאות).

ג. UX יציב וברור בדיאלוג תמלול
- `src/components/SummarizeRecordingDialog.tsx`
  - להשאיר polling, אבל להציג סיבת כשל אמיתית מהשרת (timeout/invalid_media/etc.).
  - להוסיף Retry ברור בכפתור ייעודי (ולא רק fallback פנימי).
  - עבור chunking: להציג התקדמות אמיתית + מצב “ממשיך ברקע”.

ד. בחירת קובץ נכון לפגישה
- `src/pages/Recordings.tsx`
  - לשמר תיעדוף `audio_only` לתמלול (כבר קיים), ולהוסיף guard שאם אין `audio_only` יוצג הסבר ידידותי ונתיב חלופי.

ה. קשיחות Tenant/URL (כדי למנוע “עובד בטנאנט אחר”)
- לאחד לוגיקת החלפת tenant לנקודת אמת אחת.
- להבטיח שברגע מעבר ארגון, URL מתעדכן מיד ורק אז מתבצעות שאילתות.
- להוסיף אינדיקציית tenant פעיל במסך הקלטות (כותרת/תג קטן).

4) למה זה יפתור את הבעיה
- כיום קבצים גדולים “נופלים בין הכיסאות” בגלל חסימת download path; אחרי התיקון הם יעברו chunking כמו שתוכנן.
- הורדת GPT-per-chunk מורידה משמעותית זמני ריצה וכשלים.
- timeout guards + הודעות כשל ברורות = אין יותר “נראה תקוע” בלי סיבה.
- קשיחות tenant תמנע false negatives של “אין הקלטה/לא עובד”.

5) בדיקות קבלה (E2E)
- תרחיש 1: קובץ audio_only קטן (<25MB) → `completed`.
- תרחיש 2: קובץ audio_only גדול (>25MB) → מעבר ל-chunking → `completed`.
- תרחיש 3: timeout יזום → `failed` עם error ברור + Retry עובד.
- תרחיש 4: מעבר tenant → URL/נתונים/תמלול עקביים בארגון הנכון.

6) קבצים לשינוי
- `supabase/functions/transcribe-recording/index.ts`
- `supabase/functions/transcribe-voice/index.ts`
- `src/components/SummarizeRecordingDialog.tsx`
- `src/pages/Recordings.tsx`
- (אופציונלי) רכיב החלפת tenant: `src/components/layout/AppLayout.tsx` / `src/components/layout/AppSidebar.tsx`
