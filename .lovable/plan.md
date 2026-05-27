## המטרה
טריגר אוטומציה חדש שמופעל אוטומטית כאשר חיבור (Google Analytics / Ads / Search Console / Gmail / Calendar / Facebook וכו') מתנתק או דורש חיבור מחדש — כדי שתוכל להגדיר אוטומציה ששולחת התראה (WhatsApp / Email / Task) ברגע שזה קורה, במקום לגלות שבועיים אחר כך שהדוחות ריקים.

## ארכיטקטורה
היום כל אינטגרציות גוגל כבר מסמנות `settings->>'needs_reauth' = true` בטבלת `tenant_integrations` ברגע שגוגל דוחה את ה-refresh token (ראיתי ב-`sync-google-analytics-data`, `sync-google-ads-data`, `google-ads-auth`). נשתמש בזה כמקור אמת אחיד.

### 1. Database Trigger (מרכזי — כיסוי לכל החיבורים)
טריגר Postgres על `tenant_integrations` שמתעורר ב-UPDATE כאשר `(OLD.settings->>'needs_reauth') IS DISTINCT FROM 'true'` וה-`NEW.settings->>'needs_reauth' = 'true'`. הטריגר קורא לפונקציית `pg_net.http_post` שמפעילה את ה-Edge Function `trigger-automation` עם:

```json
{
  "trigger_type": "integration_disconnected",
  "tenant_id": "<uuid>",
  "payload": {
    "integration_type": "google_analytics",
    "integration_name": "Google Analytics",
    "last_error": "...",
    "last_error_at": "...",
    "disconnected_at": "<now>"
  }
}
```

זה מבטיח שכל אינטגרציה שמסמנת `needs_reauth` תפעיל את הטריגר — בלי שצריך לשנות כל edge function בנפרד.

### 2. רישום הטריגר ב-UI של בונה האוטומציות
ב-`src/components/automations/StepConfigPanel.tsx` תחת הקטגוריה `🔗 אינטגרציות`, נוסיף:
```ts
{ value: "integration_disconnected", label: "חיבור התנתק / דורש חיבור מחדש" },
```

המשתמש יוכל לבחור אותו כטריגר, ובשלב הפעולה לבחור: שלח WhatsApp / Email / צור משימה — עם משתנים `{{integration_name}}`, `{{last_error}}`, `{{disconnected_at}}` בתוך הטקסט.

### 3. עדכון `trigger-automation` edge function
לוודא שהפונקציה מקבלת את ה-`trigger_type` החדש ומעבירה את ה-`payload` ל-template variables של הצעדים. זה כבר הדפוס הקיים, אבל נוסיף `integration_disconnected` למיפוי המשתנים הזמינים בעריכת ההודעה.

### 4. Idempotency / מניעת ספאם
נוסיף בטריגר ה-DB תנאי שלא יורה אם `last_disconnect_trigger_at` קרוב לעכשיו (פחות מ-24 שעות מאז ההתראה האחרונה). הסימון יישמר ב-`settings->>'last_disconnect_trigger_at'` ויעודכן ע"י ה-edge function אחרי שיגור מוצלח.

### 5. תיעוד דוגמת אוטומציה מובנית (אופציונלי)
נוסיף ב-`src/pages/Automations.tsx` כפתור "צור אוטומציה לדוגמה: התראת ניתוק חיבור" שיוצר אוטומציה מוכנה עם הטריגר החדש + צעד WhatsApp לטלפון בעלים.

## קבצים שיתעדכנו
- **migration חדשה**: פונקציה + טריגר על `tenant_integrations` + שימוש ב-`pg_net`
- `src/components/automations/StepConfigPanel.tsx` — הוספת הטריגר לרשימה
- `supabase/functions/trigger-automation/index.ts` — תמיכה ב-`integration_disconnected` ובמשתני ה-payload
- אופציונלי: `src/pages/Automations.tsx` — כפתור יצירת אוטומציה מובנית

## מה לא נכלל בשלב הזה
- **אימות דומיין** — נטפל בו בשלב הבא כפי שביקשת
- שינוי לוגיקת רענון הטוקנים עצמה (זה נושא נפרד שכבר דנו בו)

## שאלת הבהרה אחת
האם תרצה שהטריגר יורה גם כאשר אינטגרציה **מושבתת ידנית** (`is_active = false`), או רק על ניתוקים אוטומטיים מצד הספק (refresh token נדחה)? ההמלצה שלי: רק אוטומטיים, כי השבתה ידנית היא פעולה מודעת ולא דורשת התראה.