
## תיקון: קישור שיתוף של דוח SEO מציג "אין דוחות SEO"

### הבעיה
בקישור השיתוף `https://after-lead.com/shared/table/dvrvn-7r67` של "דורון לוין" מופיע "אין דוחות SEO", למרות שבתצוגה הפנימית הדוח נטען מצוין.

### שורש הבעיה
בדקתי את ה-DB:

| מקור | client_id |
|---|---|
| `crm_tables.client_id` (הנכון) | `cb3d38ec…` (דורון לוין) |
| `integration_settings.clientId` (ישן/תקוע) | `496e649a…` |
| `ahrefs_reports` קיים עבור | `cb3d38ec…` בלבד |

ב-Edge Function `public-table` שורה 120:
```ts
const targetClientId = settings.clientId || table.client_id;
```
הסדר הפוך — ה-`settings.clientId` הישן גובר על `table.client_id` האמיתי, ולכן השאילתה מחפשת דוחות תחת לקוח שגוי ומחזירה 0 תוצאות.

זוהי **בדיוק אותה הבעיה** שתיקנתי בעבר ב-`DynamicTableView.tsx` (הסיפור של Woodhill / Berliner) — רק שהיא קיימת גם במסלול הציבורי של ה-Edge Function.

### התיקון

#### `supabase/functions/public-table/index.ts`
שינוי ממוקד בשורה 120:

```ts
// לפני
const targetClientId = settings.clientId || table.client_id;

// אחרי — מעדיפים את ה-client_id האמיתי של הטבלה
const targetClientId = table.client_id || settings.clientId;
```

זה ייישר את לוגיקת המסלול הציבורי עם המסלול הפנימי שכבר מתוקן, ויחזיר את הדוח של דורון לוין (וכל לקוח דומה שהיה לו פעם `clientId` ישן בתוך ה-settings).

### מה לא משתנה
- שאר הלוגיקה (GA, GSC, פילטר תאריכים, paginated records) — ללא שינוי
- טבלאות אחרות שאין להן `client_id` ישיר ימשיכו להישען על `settings.clientId` כ-fallback

### בדיקה
לאחר הפריסה, פתיחת `https://after-lead.com/shared/table/dvrvn-7r67` תציג את הדוח המלא (Ahrefs + GSC + Analytics אם מקושרים), בדומה לתצוגה הפנימית.

### קובץ לעדכון
- `supabase/functions/public-table/index.ts` (שורה 120)
