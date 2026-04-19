

## ההבנה

המשתמש מבקש שני שינויים:

### 1. סנכרון תמיד עד היום (כולל)
לא משנה מה הפילטר התצוגתי (אתמול / שבוע שעבר / 30 ימים), כשהמשתמש לוחץ "סנכרן" — הסנכרון תמיד צריך למשוך נתונים **מתאריך ההתחלה של הפילטר ועד היום** (כולל היום), כדי לוודא שהנתונים תמיד עדכניים.

### 2. סנכרון אוטומטי 2x ביום ל-Google Analytics
כיום יש cron אוטומטי לפייסבוק (insights/leads/ecommerce) ול-Google Ads, אבל **אין cron ל-Google Analytics**. צריך להוסיף.

---

## הבעיה הנוכחית

בקובץ `src/pages/DynamicTableView.tsx` (שורות 161-227), הפונקציה `getMainFilterSyncRange` מחזירה `endDate = yesterday` עבור רוב הפילטרים (`last_7_days`, `last_30_days`, `yesterday` וכו'). זה תוקן בעבר עבור פייסבוק כדי להתאים את הספירה ל-FB UI, אבל זה גם משפיע על הסנכרון הידני של GA / GSC / Google Ads דרך `DashboardView.tsx` ועל סנכרון GA ב-`DynamicTableView.tsx`.

המשתמש רוצה: **הסנכרון תמיד יסתיים `today`**, גם כשהפילטר התצוגתי הוא "אתמול" או "שבוע שעבר" — כי הסנכרון אמור להביא את הנתונים העדכניים ביותר. הסינון בתצוגה יסנן בנפרד.

---

## התיקון

### א. הפרדה בין "טווח תצוגה" ל"טווח סנכרון"

ב-`src/pages/DynamicTableView.tsx`, פונקציית `getMainFilterSyncRange` תשתנה כך ש-**`endDate` תמיד יהיה `today`** (פורמט `yyyy-MM-dd`), בלי קשר לפילטר. רק `startDate` ייקבע לפי הפילטר:

- `today` / `yesterday` / `last_7_days` / `last_14_days` / `last_30_days` / `last_90_days` / `last_180_days` / `last_365_days` → `startDate` לפי הפילטר, **`endDate = today`**.
- `last_week` → סנכרון מתחילת השבוע שעבר עד **today** (במקום עד סוף השבוע שעבר).
- `last_month` → סנכרון מתחילת החודש שעבר עד **today**.
- `custom` → נשאר כמו שהמשתמש בחר ידנית (כי זו בחירה מפורשת).
- `all` → נשאר `2020-01-01` עד `today`.

**חשוב:** השינוי משפיע רק על **סנכרון** — הסינון בתצוגה (`DynamicTableView` filtering) ימשיך להציג את החלון הנכון לפי הפילטר. זה לא ישפיע על ספירת לידים בפייסבוק כי הספירה ב-UI נעשית מסינון נתונים ב-frontend, לא מהסנכרון.

### ב. הוספת cron ל-Google Analytics

1. **יצירת `supabase/functions/cron-sync-google-analytics/index.ts`** — פונקציה במבנה דומה ל-`cron-sync-facebook-insights`:
   - שולפת את כל הטבלאות עם `integration_type = 'google_analytics'`.
   - מחלקת ל-batches של 8 טבלאות.
   - לכל טבלה — קוראת ל-`sync-google-analytics-data` עם `startDate = today - 30d` ו-`endDate = today` (סנכרון נע של 30 ימים אחרונים).
   - מטפלת ב-self-invocation להמשך batches.
   - מעדכנת `last_sync_at` בטבלה.

2. **הוספת pg_cron schedule** — יידרש להריץ SQL דרך Supabase insert tool (לא migration, כי כולל ה-anon key הספציפי לפרויקט):
   ```sql
   select cron.schedule(
     'cron-sync-google-analytics-2x-daily',
     '0 6,18 * * *',  -- 06:00 ו-18:00 UTC (= 09:00 ו-21:00 שעון ישראל)
     $$ select net.http_post(
        url := 'https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/cron-sync-google-analytics',
        headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
        body := '{}'::jsonb
     ) $$
   );
   ```

---

## קבצים לעריכה

1. **`src/pages/DynamicTableView.tsx`** (שורות 161-227) — שינוי `getMainFilterSyncRange` כך ש-`endDate` תמיד `today`.
2. **`supabase/functions/cron-sync-google-analytics/index.ts`** — קובץ חדש, cron handler ל-GA.
3. **SQL insert** — הוספת pg_cron schedule שמריץ את הפונקציה ב-06:00 וב-18:00 UTC (פעמיים ביום).

## תוצאה צפויה

- **סנכרון ידני:** לא משנה אם המשתמש מסתכל על "אתמול" או "שבוע שעבר" — לחיצה על "סנכרן" תמיד תעדכן עד היום, כך שהנתונים העדכניים יקלטו.
- **סנכרון אוטומטי:** Google Analytics יסתנכרן 2x ביום (כמו פייסבוק/Google Ads) — תמיד 30 ימים אחרונים, מסתיים בתאריך הריצה.

