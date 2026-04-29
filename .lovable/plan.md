כן — בדקתי את זה לעומק בקוד, והסיבה שזה קורה היא לא נקודתית ל-GSC/GA בלבד. יש כאן בעיית ארכיטקטורה: קישור השיתוף לא באמת מרנדר את אותו דשבורד/אותו דוח, אלא גרסה ציבורית נפרדת שנבנתה מחדש עם לוגיקה משוכפלת.

לכן כל פעם שמתקנים משהו במסך המקורי — הדוח, הדשבורד, SEO, Analytics, WooCommerce, סיכומי קמפיינים, טווחי תאריכים וכו׳ — קישור השיתוף לא בהכרח מתעדכן יחד איתו. זה בדיוק למה אתה מרגיש שכל פעם צריך להגיד לי “גם את זה בשיתוף”.

## מה מצאתי

1. הדשבורד הפנימי משתמש ב:
   - `DashboardView`
   - `SeoReportTabs`
   - `SeoDashboardView`
   - `GoogleAnalyticsDashboard`
   - `WooCommerceDashboard`
   - `crm-records` כפונקציית קריאת נתונים מאומתת

2. קישור השיתוף של הדשבורד משתמש ב:
   - `SharedDashboard`
   - `PublicSeoView`
   - `PublicWooCommerceView`
   - `public-dashboard` כפונקציה ציבורית נפרדת

3. הדוח/טבלה הפנימית משתמשים ב:
   - `DynamicTableView`
   - `crm-records`
   - קומפוננטות מלאות לפי סוג אינטגרציה

4. קישור השיתוף של טבלה משתמש ב:
   - `SharedTable`
   - `public-table`
   - חישובים משוכפלים משלו

כלומר כרגע יש שני מסלולים:

```text
מסך פנימי:
DashboardView / DynamicTableView
        ↓
קומפוננטות מלאות + crm-records

קישור שיתוף:
SharedDashboard / SharedTable
        ↓
קומפוננטות ציבוריות חלקיות + public-dashboard/public-table
```

זו הסיבה העיקרית לחוסר התאמה.

## דוגמאות לפערים שכבר קיימים

- SEO בדשבורד הפנימי מרנדר `SeoReportTabs`, כולל Ahrefs + GSC + Analytics + בחירת טבלאות מקושרות + fallback-ים.
- SEO בקישור השיתוף מרנדר `PublicSeoView`, שהוא גרסה חלקית, ולכן כל שינוי ב-SEO הפנימי לא עובר אוטומטית לשיתוף.
- `public-dashboard` משחזר ידנית חלק מהלוגיקה של GA/GSC במקום להשתמש באותו scope/logic של `SeoReportTabs`.
- טווחי תאריכים מחושבים בכמה מקומות שונים (`crm-records`, `public-dashboard`, `public-table`, `DynamicTableView`) ולכן קל מאוד לקבל הבדלים במספרים.
- סיכומי פייסבוק/גוגל/אנליטיקס קיימים גם בפנימי וגם בשיתוף, אבל כקוד נפרד — אז תיקון באחד לא מבטיח תיקון בשני.
- דוח טבלה משותף לא באמת משתמש באותו render path כמו `DynamicTableView`, אלא בונה UI נפרד.

## היעד

להפוך את קישורי השיתוף ל-“אותו דוח בדיוק, רק בלי פעולות עריכה/סנכרון/הרשאות פנימיות”.

כלומר:

```text
מקור אחד לאמת:
Report/Dashboard Shared Components
        ↓
Internal view: עם auth + פעולות ניהול
Public share view: אותו render, public data provider, read-only
```

## תוכנית יישום

### 1. לאחד את שכבת התצוגה של הדשבורד
אחלץ מתוך `DashboardView` קומפוננטת תצוגה משותפת, למשל:

```text
DashboardReportContent
```

היא תקבל props מוכנים:
- dashboard
- tables
- records
- dateFilter
- platformFilter
- נתוני WooCommerce
- clientId / tenant scope
- מצב public/readOnly

ואז:
- `DashboardView` הפנימי ישתמש בה.
- `SharedDashboard` ישתמש באותה קומפוננטה בדיוק.

ההבדל היחיד יהיה מקור הנתונים והפעולות:
- בפנימי: יש כפתורי שיתוף, רענון, סנכרון, בחירת חיבורים.
- בשיתוף: read-only בלבד.

### 2. לאחד את שכבת התצוגה של טבלה/דוח
אעשה אותו דבר עבור `DynamicTableView` ו-`SharedTable`:

```text
DynamicTableReportContent
```

כך שהשיתוף לא יחשב מחדש KPIs/קמפיינים בצורה אחרת, אלא ישתמש באותה קומפוננטה שמציגה את הדוח הפנימי.

### 3. לתקן את SEO כך שהשיתוף ישתמש באותה לוגיקה כמו הפנימי
במקום ש-`SharedDashboard` יציג `PublicSeoView` חלקי, אעביר אותו למסלול ציבורי שמחקה את `SeoReportTabs`/`SeoDashboardView`:

- Ahrefs reports מאותו client/scope.
- GSC data מאותה טבלה מקושרת או fallback תקין.
- GA records מאותה טבלה מקושרת, כולל `monthly_channel`, `channel_group`, `monthly_organic`, `daily_source`.
- אותו גרף תנועה: Analytics כשיש, Ahrefs רק fallback.
- אותה טבלת מילות מפתח עם GSC enrichment.

אם יש רכיבים עם פעולות פנימיות כמו “סנכרון Ahrefs”, “בחר פרויקט”, “בחר חיבור Analytics” — הם יוסתרו ב-public mode, אבל התצוגה עצמה תהיה זהה.

### 4. לאחד חישובי תאריכים
אעביר את חישוב טווחי התאריכים למקור אחד או לפחות אשווה את כל המסלולים:

- `crm-records`
- `public-dashboard`
- `public-table`
- `DashboardView`
- `DynamicTableView`

במיוחד:
- `last_7_days`
- `last_30_days`
- `this_month`
- `last_month`
- timezone Asia/Jerusalem מול UTC
- האם “היום” כלול או לא

המטרה: אותו filter באותו יום יחזיר אותו טווח בדיוק בכל המסכים.

### 5. לשפר את הפונקציות הציבוריות כך שיחזירו payload מלא ואחיד
אעדכן את:

- `supabase/functions/public-dashboard/index.ts`
- `supabase/functions/public-table/index.ts`

כדי שיחזירו את כל הנתונים שהקומפוננטות המשותפות צריכות, באותו מבנה ככל האפשר למסך הפנימי.

במיוחד אבדוק:
- pagination מעבר ל-1000 רשומות.
- שמירת records ללא date רק איפה שגם הפנימי שומר אותם.
- cross-tenant/shared-agency scope ללקוחות משותפים.
- טבלאות GA/GSC מקושרות לפי `integration_settings` וגם fallback לפי client.
- WooCommerce לפי אותו tenant/client scope כמו הפנימי.

### 6. להוסיף מנגנון “parity guard” פשוט
כדי שזה לא יחזור בעתיד, אוסיף בקוד מבנה שמקשה על יצירת פערים:

- helper משותף לחישובי KPI.
- helper משותף ל-date ranges.
- helper משותף לזיהוי סוג קמפיין: leads/ecommerce.
- helper משותף לבניית chart data.

כך שאם מתקנים חישוב בדוח הפנימי, קישור השיתוף יקבל את זה אוטומטית.

### 7. בדיקות ידניות אחרי היישום
אבדוק את אותו client בשני מסכים:

1. דשבורד פנימי מול קישור שיתוף:
   - tab הכל
   - Facebook
   - Google Ads
   - Analytics
   - SEO
   - WooCommerce

2. דוח/טבלה פנימית מול קישור שיתוף:
   - Facebook leads
   - Facebook ecommerce
   - Google Ads leads/ecommerce
   - Google Analytics
   - Google Search Console
   - Ahrefs/SEO

3. טווחי תאריכים:
   - 7 ימים אחרונים
   - 30 יום אחרונים
   - החודש
   - חודש קודם

## מה לא אעשה

- לא אחשוף נתונים פרטיים בלי token שיתוף פעיל.
- לא אעקוף הרשאות משתמשים במסכים פנימיים.
- לא אכניס לוגיקה נוספת ידנית רק ל-GSC/GA כפלסטר; המטרה היא תיקון רוחבי.

## תוצאה צפויה

אחרי התיקון, קישור השיתוף יהיה read-only mirror של הדוח/דשבורד:

- אותו layout ככל האפשר.
- אותם KPIs.
- אותם גרפים.
- אותם מקורות נתונים.
- אותם filters.
- SEO/GA/GSC לא יצטרכו תיקונים נפרדים בכל פעם.

המשמעות: כשנעדכן בעתיד את הדשבורד או הדוח הפנימי, קישור השיתוף יקבל את אותו שינוי אוטומטית, במקום שנצטרך לתקן כל מקרה בנפרד.