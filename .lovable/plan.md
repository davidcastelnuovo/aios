

# תוכנית: הוספת כלי סנכרון Meta Ads לכרמן

## הבעיה
כרמן יכולה לראות את טבלאות ה-CRM (דרך `list_dynamic_tables`) ולנתח ביצועי קמפיינים (`analyze_campaign_performance`), אבל **אין לה כלי להפעיל סנכרון נתונים** מול Meta Ads. היא לא יכולה לקרוא ל-Edge Function `sync-meta-ads-data` ולכן מודיעה שהיא לא מסוגלת לבצע את הפעולה.

## הפתרון
הוספת כלי `sync_meta_ads` ל-Carmen ב-`ai-support-chat/index.ts` שיאפשר לה:
1. למצוא את טבלאות ה-CRM מסוג `meta_ads` של לקוח ספציפי או כל הלקוחות
2. לקרוא ל-Edge Function `sync-meta-ads-data` עבור כל טבלה
3. להחזיר סיכום של הסנכרון

## שינויים טכניים

### קובץ: `supabase/functions/ai-support-chat/index.ts`

**1. הוספת הגדרת הכלי** (באזור GROUP 4/5):
```
sync_meta_ads - סנכרון נתוני Meta Ads עבור לקוח או כל הלקוחות
פרמטרים: client_id (אופציונלי), client_name (אופציונלי)
```

**2. הוספת handler ב-switch/case**:
- אם ניתן `client_id` או `client_name` — מחפש את טבלאות ה-CRM שלו עם `integration_type = 'meta_ads'`
- אם לא ניתן — מחפש את כל הטבלאות מסוג `meta_ads` בטננט
- לכל טבלה — קורא ל-`sync-meta-ads-data` דרך `supabaseClient.functions.invoke`
- מחזיר סיכום: כמה טבלאות סונכרנו, כמה רשומות, שגיאות

**3. לוגיקת הסנכרון**:
- Carmen תשתמש ב-service role דרך `supabaseClient.functions.invoke('sync-meta-ads-data', { body: { table_id } })`
- בגלל שה-Edge Function `sync-meta-ads-data` דורשת auth header, נעביר את ה-authorization header המקורי של המשתמש
- נטפל בלקוחות ללא טבלת meta_ads (נדלג עליהם ונדווח)

### קובץ: `supabase/functions/sync-meta-ads-data/index.ts`
- ייתכן שנצטרך לתמוך גם ב-service role auth (כרגע משתמש ב-anon key) כדי שכרמן תוכל לקרוא לו בצורה תקינה

## תוצאה צפויה
כרמן תוכל לקבל פקודה כמו "סנכרני את הנתונים של הלקוחות עם פייסבוק" ולבצע את הסנכרון אוטומטית עבור כל לקוח שיש לו `meta_ads_account_id` וטבלת CRM מתאימה.

