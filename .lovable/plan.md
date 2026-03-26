

# בניית בסיס מרכזיה וירטואלית (בלי API עדיין)

## מה נבנה עכשיו
הבסיס המלא למרכזיה: טבלאות DB, ממשק היסטוריית שיחות, אייקון חיוג, ודף הגדרות טלפוניה. את החיבור ל-Paycall API נחבר ברגע שיהיה לך מפתח.

## שינויים

### 1. מיגרציית DB - טבלאות חדשות
- **`call_logs`** - לוג שיחות עם: `tenant_id`, `lead_id`, `client_id`, `caller_user_id`, `from_number`, `to_number`, `duration`, `status` (initiated/ringing/in-progress/completed/failed/no-answer), `recording_url`, `recording_duration`, `provider_call_id`, `notes`, `created_at`
- **`telephony_settings`** - הגדרות לכל משתמש: `tenant_id`, `user_id`, `personal_phone`, `virtual_number`, `auto_record` (boolean), `provider` (paycall/twilio)
- RLS policies לשתי הטבלאות (tenant isolation)
- Enable realtime על `call_logs`

### 2. אייקון טלפון + דיאלוג שיחה בתצוגת ליד ולקוח
- ב-`LeadsChatView` וב-`ClientsChatView`: כפתור טלפון ירוק ליד כפתור הטלפון הקיים
- לחיצה פותחת דיאלוג **"התקשר דרך מרכזיה"** שמראה:
  - המספר של הליד/לקוח
  - סטטוס שיחה (בהמתנה / מתקשר אליך / מחבר ללקוח / בשיחה / הסתיים)
  - כפתור "התקשר" (בינתיים יציג הודעה שצריך לחבר Paycall)
  - כפתור ניתוק

### 3. טאב "שיחות" בפאנל הפרטים של ליד ולקוח
- טאב רביעי (ליד טאבי פרטים/עדכונים/WhatsApp)
- מציג היסטוריית שיחות מהטבלת `call_logs`
- כל שיחה מציגה: תאריך, משך, סטטוס, נגן הקלטה (אם יש), הערות
- שימוש ב-`CustomAudioPlayer` הקיים לנגן הקלטות

### 4. דף הגדרות טלפוניה חדש
- דף `TelephonySettings` עם:
  - הגדרת מספר אישי (המספר שאליו מתקשרים קודם)
  - הגדרת מספר וירטואלי
  - toggle הקלטה אוטומטית
  - שדה API Key של Paycall (ישמר ב-`tenant_integrations`)
- הוספת קישור לדף מתוך דף האינטגרציות

### 5. רכיב `CallDialog.tsx` חדש
- דיאלוג עם UI של שיחה פעילה
- טיימר משך שיחה
- סטטוס בזמן אמת (ישתמש ב-realtime על `call_logs`)
- כפתורי פעולה: חייג, נתק, הוסף הערה

### 6. Edge Function: `make-paycall-call`
- Skeleton בלבד - יקבל פרמטרים ויחזיר שגיאה "Paycall not configured" עד שיהיה API key
- מוכן לחיבור ל-API ברגע שיהיה תיעוד

### 7. Edge Function: `paycall-webhook`  
- Skeleton שמקבל webhooks ושומר ב-`call_logs`
- `verify_jwt = false` כי Paycall שולח ישירות

### 8. ניתוב ותפריט
- Route חדש `/telephony-settings`
- הוספת כרטיס אינטגרציה בדף Integrations

## סדר ביצוע
1. מיגרציית DB (טבלאות + RLS)
2. Edge Functions (skeletons)
3. רכיב CallDialog + CallHistoryTab
4. עדכון LeadsChatView + ClientsChatView (אייקון + טאב שיחות)
5. דף TelephonySettings + ניתוב

