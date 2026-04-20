
לתיקון הבעיה הזאת אבצע מעבר מלוגיקה של “tenant פעיל” ללוגיקה של “הלקוח והסוכנות המשותפת שלו”, כך שדוח SEO ייטען נכון בלי קשר אם פתחת אותו מ-Marketing Captain או מ-DMM.

## הבעיה המדויקת
כרגע כמה חלקים ב-SEO עדיין מסוננים לפי `currentTenantId` / `tenantId` קשיח:
- `DashboardView.tsx` מעביר ל-`SeoReportTabs` את ה-tenant הפעיל של המשתמש.
- `SeoReportTabs.tsx` מחפש:
  - טבלת SEO (`crm_tables`)
  - טבלאות GSC / GA קשורות
  - אינטגרציות GSC / GA דרך `useUserIntegrations`
  כולם לפי `tenant_id = tenantId`.
- `useAhrefsReports.ts` גם מחפש `ahrefs_reports` רק ב-tenant הפעיל.

במקרה של לקוח מסוכנות משותפת זה שגוי: הנתונים יכולים להיות משויכים ל-tenant אחר אבל עדיין להיות הלקוח הנכון.

## מה אבנה

### 1. שכבת resolution אחת ל-SEO לפי הלקוח, לא לפי tenant פעיל
אוסיף מסלול טעינה אחיד שמחשב את כל ה-scope הרלוונטי לדוח SEO:
- הלקוח עצמו
- `agency_id` של הלקוח
- ה-tenants הרלוונטיים דרך `agency_tenant_access`
- טבלת SEO/Ahrefs של הלקוח
- טבלאות GSC/GA של אותו לקוח
- tenant/source tenant של החיבורים

המטרה: כל המסכים של SEO ישתמשו באותו source-of-truth, ולא כל קומפוננטה תמציא tenant אחר.

### 2. תיקון `DashboardView.tsx`
במקום:
- להעביר ל-`SeoReportTabs` את `currentTenantId`

אעדכן כך ש:
- `SeoReportTabs` יקבל `clientId`
- והוא עצמו יפתור את ה-scope של הלקוח והסוכנות המשותפת
- לא תהיה תלות ב-tenant שממנו המשתמש פתח את הדשבורד

כך YTS ייטען אותו דבר מכל צד.

### 3. תיקון `SeoReportTabs.tsx`
אעדכן את השאילתות כך שלא יהיו קשיחות ל-tenant יחיד:
- חיפוש טבלת Ahrefs/SEO לפי `client_id` + נגישות דרך סוכנות משותפת
- חיפוש טבלאות GSC/GA קשורות לפי `client_id` / `agency_id` נגיש, לא רק `tenant_id`
- קישורי `linkedGscTableId`, `linkedGaTableId`, `linkedGscSiteUrl`, `linkedGscLangFilter` ימשיכו להישמר על טבלת ה-SEO עצמה, אבל הטבלה תימצא נכון גם אם נוצרה ב-tenant אחר

בנוסף אשמור על fallback זהיר:
- אם קיימת טבלת SEO מקושרת מפורשות — היא תקבל עדיפות
- אם אין — יתבצע auto-match לפי הלקוח/דומיין כמו היום

### 4. תיקון `useAhrefsReports.ts`
אפסיק לסנן רק לפי ה-tenant הפעיל עבור דוחות SEO של לקוח משותף.
במקום זאת, הלוגיקה תחזיר דוחות Ahrefs של אותו `client_id` מתוך ה-scope הנגיש של הסוכנות המשותפת.

זה חשוב כי כרגע אפילו אם GSC נטען, דוחות Ahrefs עצמם יכולים “להיעלם” אם הם יושבים ב-tenant אחר.

### 5. תיקון טעינת GSC/GA בדוח SEO
`GscIntegration` ו-visibility של לשוניות GSC/GA יתבססו על אותו scope של הלקוח:
- לא “יש חיבור ב-tenant הפעיל?”
- אלא “יש חיבור/טבלה נגישה ללקוח הזה דרך הסוכנות המשותפת?”

אם צריך, אוסיף hook/helper ייעודי ל-SEO שירחיב את `useUserIntegrations` רק למסלול הזה, בלי לשבור מסכים אחרים.

### 6. שמירה על הפרדה ולא לשבור דוחות אחרים
לא אבצע שינוי רוחבי עיוור בכל המערכת.
התיקון יהיה ממוקד למסלול SEO:
- `DashboardView`
- `SeoReportTabs`
- `SeoDashboardView` / `GscIntegration`
- `useAhrefsReports`

כך לקוחות רגילים ב-tenant יחיד ימשיכו לעבוד כמו היום, ולקוחות shared-agency יפסיקו להיות תלויים ב-tenant הפעיל.

### 7. אימות שלא נשברה המערכת
אבדוק לפחות את התרחישים הבאים:
- YTS דרך Marketing Captain
- אותו YTS דרך DMM
- לקוח רגיל שאינו shared-agency
- דוח SEO עם Ahrefs בלבד
- דוח SEO עם GSC בלבד
- דוח SEO עם Ahrefs + GSC + GA
- קישור שיתוף / צילום מסך של SEO כדי לוודא שהם משקפים את אותו דוח

## תוצאה צפויה
אחרי התיקון:
- לא יהיה משנה מאיזה tenant פתחת את הלקוח
- אם הלקוח נגיש דרך סוכנות משותפת, דוח ה-SEO ייטען נכון
- Ahrefs ו-Google Search Console יוצגו לפי הלקוח האמיתי
- לא ייעלמו ביטויים רק בגלל שהחיבור או הטבלה נוצרו ב-tenant אחר

## פרטים טכניים
קבצים עיקריים לעדכון:
- `src/pages/DashboardView.tsx`
- `src/components/dynamic-tables/SeoReportTabs.tsx`
- `src/components/dynamic-tables/SeoDashboardView.tsx`
- `src/components/dynamic-tables/seo/GscIntegration.tsx`
- `src/hooks/useAhrefsReports.ts`

שורש הבעיה:
```text
active tenant != tenant where SEO/GSC/Ahrefs artifacts were created
אבל
client_id + agency sharing כן אמורים לאפשר גישה

הקוד היום:
tenant_id-based resolution

התיקון:
client/shared-agency-based resolution
```
