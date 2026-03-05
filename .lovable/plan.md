

## הבעיה

הדיאלוג של סיכום פגישה דורש הדבקה ידנית של תמלול. אין כפתור תמלול אוטומטי. הקלטות Zoom שמורות כ-URL חיצוני (`recording_url`), והקלטות ידניות שמורות כקובץ ב-Storage (`file_path`).

## פתרון

הוספת כפתור "תמלל אוטומטית" בדיאלוג הסיכום שיעבוד בשני מצבים:

### 1. הקלטות ידניות (עם קובץ ב-Storage)
- הורדת הקובץ מ-Storage דרך Edge Function
- שליחה ל-Whisper API (OpenAI) לתמלול
- הזרקת התוצאה לשדה התמלול

### 2. הקלטות Zoom (URL חיצוני)
- הורדת הקובץ מ-Zoom דרך Edge Function (עם download_url + access token)
- שליחה ל-Whisper API לתמלול
- הזרקת התוצאה לשדה התמלול

## שינויים נדרשים

### Edge Function חדשה: `transcribe-recording`
- מקבלת `recording_id`
- שולפת את ההקלטה מ-DB
- אם `file_path` קיים → מורידה מ-Storage
- אם `recording_url` קיים → מורידה מ-Zoom (עם Zoom access token מ-`tenant_integrations`)
- שולחת את האודיו ל-Whisper API (`OPENAI_API_KEY` כבר קיים)
- מתקנת כתיב עם GPT (כמו ב-`transcribe-voice`)
- מחזירה את הטקסט

### עדכון `SummarizeRecordingDialog.tsx`
- הוספת כפתור "תמלל אוטומטית" ליד שדה התמלול
- כשלוחצים → קורא ל-Edge Function → ממלא את שדה התמלול
- מצב loading עם spinner
- טיפול בשגיאות (קובץ לא נמצא, Zoom token לא תקין וכו')

### עדכון `config.toml`
- הוספת `[functions.transcribe-recording]` עם `verify_jwt = false`

## הערה טכנית
- הקלטות Zoom יכולות להיות גדולות. Whisper תומך עד 25MB. אם הקובץ גדול מדי, נציג הודעת שגיאה ונמליץ להדביק תמלול ידנית.
- נשתמש ב-`OPENAI_API_KEY` הקיים לתמלול Whisper.
