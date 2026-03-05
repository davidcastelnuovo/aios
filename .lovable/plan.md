
מצוין — עברתי על הקוד והלוגים האחרונים לעומק.

Do I know what the issue is? כן.

הבעיה הנוכחית כבר לא רק זיכרון:
1) ה-fallback מוצא הקלטת `audio_only` קטנה (≈21.8MB), אבל  
2) ההורדה מגיעה עם `content-type: application/octet-stream`,  
3) והפונקציה שולחת את ה-blob ל-Whisper בלי נרמול פורמט אמיתי → OpenAI מחזיר `Invalid file format`.

כלומר: המסלול מתקדם יפה עד התמלול, אבל נכשל על זיהוי פורמט הקובץ (לא על auth ולא על tenant).

תוכנית תיקון ממוקדת (Implementation)
1. `supabase/functions/transcribe-recording/index.ts` — נרמול קשיח של קובץ לפני Whisper  
   - להוסיף שלב `normalizeAudioFile()` לפני `whisperForm.append`.  
   - אם `content-type` הוא `application/octet-stream`, לזהות פורמט לפי:
     - `recording_type` (למשל `audio_only` → `audio/m4a` + `.m4a`)
     - magic bytes בסיסיים (ftyp/ID3/RIFF/Ogg/WebM) כשאפשר
     - fallback סופי בטוח: `.m4a` עבור audio-only  
   - ליצור `File/Blob` חדש עם MIME תקין, לא להשתמש ב-blob המקורי כמו שהוא.
   - להוסיף לוגים קצרים: `raw_content_type`, `detected_type`, `final_file_name`.

2. `supabase/functions/transcribe-recording/index.ts` — ולידציה נגד “דף HTML בתחפושת”  
   - גם אם השרת מחזיר `octet-stream`, לבדוק preview של bytes ראשונים.  
   - אם מזוהה HTML/JSON במקום מדיה, לדלג ל-URL הבא ולהחזיר שגיאה ברורה אם אין מדיה תקינה.

3. `supabase/functions/fetch-zoom-recordings/index.ts` — מניעת נתונים בעייתיים להבא  
   - לאחד את כל מסלולי insert/upsert כך שתמיד העדפה תהיה `download_url || play_url` (כרגע במסלול fallback יש היפוך).  
   - לשמור metadata נוסף אם זמין (למשל `file_extension`, `file_type`) כדי לשפר זיהוי פורמט בתמלול.

4. `src/components/SummarizeRecordingDialog.tsx` — UX לשגיאת פורמט  
   - אם מתקבלת שגיאת `invalid file format`, להציג הודעה ייעודית (לא גנרית) עם הצעה אוטומטית:
     - ניסיון חוזר על חלופה אחרת מאותו meeting (אם קיימת), או
     - מעבר להזנת תמלול ידני.

בדיקות קבלה (E2E)
1) הקלטה שכבר נכשלה (ה-346MB עם fallback ל-21.8MB) → אמורה להסתיים בתמלול תקין.  
2) הקלטת Zoom קטנה ישירות (ללא fallback) → תמלול תקין.  
3) קובץ ידני מה-storage >25MB → לוודא שמסלול chunking לא נשבר.  
4) לוגים ב-`transcribe-recording` לא צריכים להראות שוב:
   - `Invalid file format`
   - `Memory limit exceeded` במסלול קבצים קטנים.

פרטים טכניים (ללא שינוי מוצרי)
- מוקד התיקון הוא נרמול MIME/extension לפני Whisper, לא שינוי ארכיטקטורה.
- אין צורך בשינוי סכימה קריטי כדי לפתור עכשיו; metadata נוסף הוא hardening לשלב הבא.
- הבידוד הרב-ארגוני נשמר (כל השאילתות נשארות עם `tenant_id`).
