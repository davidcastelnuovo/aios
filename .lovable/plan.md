

## משיכת הקלטות קיימות מ-Zoom

### מה ייבנה
כפתור "משוך הקלטות קיימות" בדף ZoomSettings שמאפשר לשלוף הקלטות ישנות מחשבון Zoom ולשמור אותן בטבלת `zoom_recordings`.

### שינויים

**1. Edge Function חדשה: `supabase/functions/fetch-zoom-recordings/index.ts`**
- מקבלת `tenant_id` ואופציונלית `from_date` (ברירת מחדל: 30 יום אחורה)
- שולפת את ה-credentials מ-`tenant_integrations`
- מבצעת Server-to-Server OAuth token request ל-Zoom (`https://zoom.us/oauth/token` עם `grant_type=account_credentials`)
- קוראת ל-`GET https://api.zoom.us/v2/users/me/recordings?from=...&to=...`
- עוברת על כל הפגישות עם הקלטות ושומרת ב-`zoom_recordings` (upsert לפי `meeting_id` כדי לא ליצור כפילויות)
- מחזירה כמה הקלטות נשמרו

**2. עדכון `src/pages/ZoomSettings.tsx`**
- הוספת כפתור "משוך הקלטות" מעל טבלת ההקלטות (ליד שורת החיפוש)
- אופציה לבחור טווח תאריכים (ברירת מחדל: 30 יום אחורה)
- mutation שקורא ל-Edge Function עם loading state
- Toast עם תוצאה (כמה הקלטות נמשכו)
- רענון אוטומטי של הטבלה אחרי המשיכה

**3. עדכון `supabase/config.toml`** - לא נדרש, ה-JWT verification מטופל בקוד

### זרימה טכנית
```text
כפתור "משוך הקלטות"
  → Edge Function fetch-zoom-recordings
    → POST zoom.us/oauth/token (account_credentials grant)
    → GET api.zoom.us/v2/users/me/recordings?from=...&to=...
    → UPSERT to zoom_recordings (skip duplicates by meeting_id)
  → Toast: "נמשכו X הקלטות חדשות"
  → Refresh recordings table
```

