

## הבעיה

השגיאה: `Invalid file format. Supported formats: ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm']`

Whisper API מזהה את פורמט הקובץ לפי **שם הקובץ** שנשלח ב-FormData. כשקובץ יורד מ-Storage, ה-`fileName` עלול להיות ללא סיומת מזוהה (למשל UUID בלבד), או שה-blob type הוא `application/octet-stream`.

## תיקון

עדכון `transcribe-recording/index.ts` - הוספת לוגיקה שמבטיחה ש-fileName תמיד יסתיים בסיומת מוכרת:

1. **מיפוי content-type לסיומת**: `audio/mp4` → `.mp4`, `audio/mpeg` → `.mp3`, `video/mp4` → `.mp4` וכו'
2. **בדיקת סיומת קיימת**: אם `fileName` כבר מסתיים בסיומת מוכרת - לא לשנות
3. **ברירת מחדל**: אם אין סיומת מזוהה - להוסיף `.mp4`
4. **לוג**: הדפסת fileName ו-contentType לפני שליחה ל-Whisper לצורכי דיבוג

שינוי אחד בקובץ `supabase/functions/transcribe-recording/index.ts`.

