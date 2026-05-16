## המטרה
להחליף את Whisper ב-Gemini (דרך Lovable AI) לתמלול אוטומטי של הקלטות Zoom, כדי שגם סרטונים גדולים (>25MB) יתומללו אוטומטית בלי צורך בחיתוך לצ'אנקים.

## למה זה פותר את הבאג
Whisper מוגבל ל-25MB לקובץ. Gemini 2.5 מקבל אודיו של עד ~9.5 שעות בקריאה אחת — אז כל קובץ של פגישת Zoom סטנדרטית עובר בלי חיתוך.

## שינויים

### 1. `supabase/functions/transcribe-recording/index.ts` — שכתוב הליבה
- להסיר את כל הלוגיקה של `MAX_EDGE_FILE_SIZE`, חיפוש alternative audio recording, ו-`needs_chunking` + העלאה ל-Storage.
- במקום זה: להוריד את הקובץ מ-Zoom (או מ-Storage עבור הקלטות ידניות), להמיר ל-base64, ולקרוא ל-Lovable AI Gateway עם `google/gemini-2.5-flash` בפורמט OpenAI-compatible עם `input_audio`.
- להחזיר `{ text: "..." }` באותו פורמט הקיים, כדי לשמור תאימות לקוראים (`process-new-recording` ו-`SummarizeRecordingDialog`).
- לטפל בקבצים גדולים מאוד (>20MB base64): להעלות ל-Gemini Files API דרך מפתח Google ישיר, או להישאר בגבול הסביר ל-Lovable AI Gateway (לרוב פגישות Zoom של עד שעה+ נכנסות).

### 2. `supabase/functions/transcribe-voice/index.ts` — תמלול הקלטות קול ידניות
- להחליף את הקריאה ל-OpenAI Whisper בקריאה ל-Lovable AI עם Gemini, באותה הלוגיקה.

### 3. `supabase/functions/process-new-recording/index.ts` — ניקוי
- להסיר את הבלוק שמדלג על `needs_chunking` (כבר לא רלוונטי).

### 4. `src/components/SummarizeRecordingDialog.tsx` — ניקוי קוד מת
- להסיר את כל לוגיקת