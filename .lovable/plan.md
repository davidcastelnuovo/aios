
אחלה, עכשיו יש אבחון מדויק למה זה נתקע שוב ושוב — ולא “ניחוש”.

## מה הבעיה בפועל (Root Cause)
1. ב-`transcribe-recording` יש שאילתה ל-`tenant_integrations` עם `config`:
   - `select('config, settings')`
   - אבל בטבלה **אין בכלל עמודת `config`** (יש רק `settings`).
   - בפועל זה מפיל את שליפת האינטגרציה, ולכן אין טוקן Zoom בפונקציה.
2. בלי טוקן, הורדת Zoom מחזירה HTML של דף צפייה/לוגין במקום מדיה, ולכן מתקבלת:
   - `Failed to download valid media from Zoom: Non-media response (text/html...)`
3. בנוסף, ב-`zoom-webhook` נשמר `play_url` לפני `download_url`, מה שמגדיל סיכוי ל-HTML במקום קובץ.

## תוכנית תיקון (ממוקדת)
1. **תיקון קריטי בפונקציית תמלול** `supabase/functions/transcribe-recording/index.ts`
   - להחליף שליפה ל-`select('settings')` בלבד.
   - להוסיף טיפול שגיאה מפורש אם שליפת אינטגרציה נכשלה (ולא להמשיך “בשקט”).
   - לחלץ credentials מ-`settings`, להנפיק access token חדש (Server-to-Server) כשצריך.
   - להוריד קובץ Zoom עם URL של download + token, ורק אם מתקבלת מדיה אמיתית להמשיך.

2. **חיזוק קליטה מה-Webhook** `supabase/functions/zoom-webhook/index.ts`
   - לשמור `recording_url` כ-`file.download_url || file.play_url` (העדפה ל-download).
   - אם יש `payload.download_token`, להעדיף אותו על פני סיסמת פגישה בשדה הקיים.

3. **שיפור הודעות שגיאה בצד לקוח** `src/components/SummarizeRecordingDialog.tsx`
   - להציג למשתמש את פירוט השגיאה שחוזר מהפונקציה (ולא רק “non-2xx”).
   - להוסיף רמז ברור כשיש כשל באוטוריזציה/קישור Zoom.

4. **בדיקות end-to-end לפני סגירה**
   - לבדוק תמלול להקלטת Zoom שנכשלה קודם (play URL).
   - לבדוק תמלול לקובץ Zoom שמגיע כ-download URL.
   - לבדוק קובץ גדול (חלוקה לחלקים) שלא נשבר אחרי השינוי.
   - לוודא שלא נשברה תמלול מהקלטה ידנית (`file_path` מ-storage).

## קבצים שיושפעו
- `supabase/functions/transcribe-recording/index.ts`
- `supabase/functions/zoom-webhook/index.ts`
- `src/components/SummarizeRecordingDialog.tsx`

## תוצאה צפויה
- סוף ללופ של “תוקן אבל לא עובד”.
- תמלול Zoom יעבוד גם כשמקור ההקלטה התחיל כ-`play_url`.
- במקרה כשל — תופיע שגיאה ברורה שאפשר לפעול לפיה.
