## הבעיה

באוטומציה "פבליקו לידים פייסבוק" בחרת בטופס `דודי | 21/05/25` (form_id `714859200896732`). אבל:

1. הטופס הזה לא רשום ב-`tenant_integrations.settings.form_mappings` של אינטגרציית פייסבוק `1d250a3d…`.
2. הפונקציה `sync-facebook-leads` רצה רק על טפסים שיש להם רשומה ב-`form_mappings` - לכן הלידים של הטופס הזה לא נמשכו אף פעם.
3. הדיאלוג "בדוק עם ליד" (`TestFlowWithLeadDialog`) שואל רק את טבלת `leads` המקומית, ומסנן לפי `notes ILIKE '%form_id%'`. אם לא סונכרנו לידים - אין מה להציג, גם ב"כל הלידים".
4. `last_sync_at` של האינטגרציה: 11/3/2026 - האינטגרציה כמעט לא רצה.

בנוסף, `trigger_config.sync_since_date = 2026-05-31` שמור ב-step אבל אף פונקציית סנכרון לא קוראת אותו.

## הפתרון

### 1. רישום אוטומטי של הטופס ב-`form_mappings` בעת שמירת ה-trigger
ב-`StepConfigPanel.tsx` (או היכן ש-trigger של Facebook נשמר), כשמשתמש בוחר `facebook_form_id` + `facebook_integration_id`, להוסיף upsert ל-`tenant_integrations.settings.form_mappings[form_id]` עם ברירות מחדל:
```
{
  agency_id: null,
  sales_person_ids: [],
  fields: {},   // mapping ריק - הפונקציה תיפול חזרה לברירות מחדל
}
```
זה מבטיח שהקרון הקיים ימשוך לידים מהטופס.

### 2. כפתור "סנכרן עכשיו" בדיאלוג הבדיקה
ב-`TestFlowWithLeadDialog.tsx`, כש-`facebookFormId` קיים ולא נמצאו לידים בטווח, להוסיף כפתור "משוך לידים מפייסבוק עכשיו" שקורא ל-`sync-facebook-leads` עם `integration_id` + `tenant_id`, ואז מרענן את ה-query. כך המשתמש לא צריך לחכות לקרון.

### 3. תמיכה ב-`sync_since_date` ב-sync-facebook-leads (אופציונלי, אם נרצה להתאים את חלון הזמן)
כעת הפונקציה קבועה על 30 ימים אחורה. נשנה כך שאם הקריאה כוללת `since_date` (מ-trigger config) נשתמש בו במקום.

### 4. הרצת סנכרון ראשוני מיידית
אחרי שמירת trigger Facebook (סעיף 1), להריץ סנכרון פעם אחת כדי שהלידים יהיו זמינים לבדיקה ולטיגור.

## קבצים שיתעדכנו
- `supabase/functions/sync-facebook-leads/index.ts` - תמיכה ב-`since_date` ובקריאה לפי `form_id` ספציפי.
- `src/components/automations/StepConfigPanel.tsx` (או רכיב הטריגר של Facebook) - upsert של form_mapping + טריגור סנכרון.
- `src/components/automations/TestFlowWithLeadDialog.tsx` - כפתור "סנכרן עכשיו" ו-refetch.

## אימות
- אחרי שמירה: לראות שהטופס `714859200896732` קיים תחת `form_mappings`.
- ללחוץ "סנכרן עכשיו" בדיאלוג ולוודא שעולים הלידים מהשבוע האחרון.
- "כל הלידים" / "שבוע אחרון" / סינון לפי form_id מציגים את ה-8 לידים שמופיעים בפייסבוק.
