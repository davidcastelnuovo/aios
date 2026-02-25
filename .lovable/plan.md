

# אינטגרציית Zoom - קבלת הקלטות פגישות בוובהוק

## מה ייבנה
אינטגרציה עם Zoom שתאפשר לקבל אוטומטית הקלטות פגישות דרך Webhook. כשפגישת Zoom מסתיימת וההקלטה מוכנה, Zoom ישלח webhook למערכת, וההקלטה תישמר ותשויך ללקוח/ליד הרלוונטי.

## רכיבים

### 1. טבלת `zoom_recordings` (מיגרציה)
- `id`, `tenant_id`, `created_at`
- `meeting_id` - מזהה הפגישה בזום
- `meeting_topic` - נושא הפגישה
- `host_email` - אימייל המארח
- `start_time`, `duration` - זמן ומשך
- `recording_url` - קישור להקלטה
- `recording_password` - סיסמה אם יש
- `recording_type` - סוג (shared_screen_with_speaker_view, audio_only וכו')
- `file_size` - גודל קובץ
- `client_id` (nullable) - שיוך ללקוח
- `lead_id` (nullable) - שיוך לליד
- `notes` - הערות
- RLS עם tenant isolation

### 2. Edge Function: `zoom-webhook`
- מקבלת POST מ-Zoom עם אירוע `recording.completed`
- מוודאת את ה-Webhook Secret Token של Zoom (Zoom שולח `event` ו-`payload`)
- תומכת ב-Zoom Webhook Validation (endpoint validation challenge)
- שומרת את פרטי ההקלטה בטבלה
- מזהה tenant לפי query param `tenant_id`

### 3. דף הגדרות `ZoomSettings.tsx`
- הזנת Account ID, Client ID, Client Secret (Server-to-Server OAuth)
- הזנת Webhook Secret Token (לאימות webhooks)
- שמירה ב-`tenant_integrations` עם `integration_type: 'zoom'`
- הצגת Webhook URL להעתקה ולהגדרה בקונסולת Zoom
- טבלת הקלטות שהתקבלו עם אפשרות שיוך ידני ללקוח/ליד

### 4. כרטיס בדף Integrations
- כרטיס Zoom חדש ברשימת האינטגרציות עם סטטוס חיבור
- ניווט לדף ההגדרות

### 5. Route חדש ב-App.tsx
- `/t/:tenantSlug/zoom-settings` → `ZoomSettings`

## פרטים טכניים

### Zoom Webhook Validation
Zoom דורש שה-endpoint יחזיר `plainToken` מוצפן עם ה-Secret Token כדי לאמת את ה-endpoint. ה-Edge Function תטפל באירוע `endpoint.url_validation` ותחזיר את התגובה הנדרשת.

### Server-to-Server OAuth
ה-credentials (Account ID, Client ID, Client Secret) נשמרים ב-`integration_settings` JSON ב-`tenant_integrations`. הם משמשים בעתיד אם תרצה גם ליצור פגישות מהמערכת (אופציונלי).

### זרימת הנתונים
```text
Zoom Cloud → recording.completed webhook → zoom-webhook Edge Function
  → אימות Secret Token
  → שמירה ב-zoom_recordings
  → שיוך אופציונלי ללקוח/ליד (ידני מהממשק)
```

### קבצים חדשים
- `supabase/functions/zoom-webhook/index.ts`
- `src/pages/ZoomSettings.tsx`

### קבצים שישתנו
- `src/App.tsx` - הוספת route
- `src/pages/Integrations.tsx` - הוספת כרטיס Zoom

