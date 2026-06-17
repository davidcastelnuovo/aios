## מה לשנות
החלפת מסך "אין דוחות SEO" בדיאלוג יצירת דוח מלא, שמאפשר לבחור מקורות נתונים ולהרכיב טבלת CRM אחת מאוחדת לכל לקוח — גם כשאין website מוגדר.

## זרימה חדשה ב-SeoReportDialog

1. **בחירת לקוח** (כפי שיש היום).
2. אם אין דוחות עדיין → לא להראות "אין דוחות". במקום זה לפתוח את **טופס יצירת דוח חדש**:
   - **דומיין/אתר** — שדה טקסט (input). אם ל-`clients.website` יש ערך → ממולא אוטומטית וניתן לעריכה. אם אין → input ריק עם placeholder. הערך הזה חי רק בדיאלוג, **לא נשמר חזרה ל-clients**.
   - **פרויקט Ahrefs** — Combobox עם רשימת פרויקטים מ-`list-ahrefs-projects`. אפשרות "ללא / לפי דומיין בלבד" כברירת מחדל אם אין התאמה.
   - **חיבור Google Search Console** — Combobox מ-`useUserIntegrations(tenantIds, "google_search_console")`. לכל חיבור מציג את האימייל ואת רשימת ה-`available_sites`. אחרי בחירת חיבור → בורר site (מתוך `available_sites` של אותו חיבור, ברירת מחדל: site שמתאים ל-domain).
   - **חיבור Google Analytics** — Combobox מ-`useUserIntegrations(tenantIds, "google_analytics")`. אחרי בחירת חיבור → בורר property (מתוך `available_properties`).
   - כל ארבעת השדות אופציונליים, אבל חייב להיות לפחות אחד (דומיין + מקור אחד) כדי שכפתור "צור דוח" יופעל.

3. כפתור **"צור דוח SEO"**:
   - אם נבחר פרויקט Ahrefs או יש דומיין → קורא ל-`fetch-ahrefs-snapshot` (כמו היום) להזרים נתוני Ahrefs.
   - יוצר **טבלת CRM אחת מאוחדת** דרך `crm-tables` עם:
     - `integration_type: 'seo_unified'` (חדש, או נשתמש ב-`ahrefs` הקיים עם כל ההגדרות מתחת)
     - `client_id`, `agency_id`, `category: 'seo'`
     - `integration_settings` מאוחד:
       ```json
       {
         "data_source": "seo_unified",
         "clientId": "...",
         "targetDomain": "<domain>",
         "ahrefs_project_id": "<id|null>",
         "gsc_integration_id": "<id|null>",
         "gsc_site_url": "<url|null>",
         "ga_integration_id": "<id|null>",
         "ga_property_id": "<id|null>"
       }
       ```
   - בסיום: ניווט לטבלה החדשה (כמו `handleCreateTable` היום).

4. אם **יש כבר דוחות**, נשאיר את תצוגת ה-snapshot הקיימת, אבל גם נוסיף בה כפתור "ערוך מקורות" (אופציה קטנה) שפותח שוב את אותו טופס בחירה כדי לעדכן את ה-integration_settings של הטבלה הקיימת — לא קריטי לאיטרציה הזו, יכול להישאר מחוץ לסקופ אם תרצה.

## קבצים שיעודכנו

### `src/components/dynamic-tables/SeoReportDialog.tsx`
- מוסיף state: `domainInput`, `selectedAhrefsProject`, `selectedGscIntegrationId`, `selectedGscSite`, `selectedGaIntegrationId`, `selectedGaProperty`.
- מוסיף queries:
  - `list-ahrefs-projects` (כבר קיים כ-edge function).
  - `useUserIntegrations(tenantIds, "google_search_console")`.
  - `useUserIntegrations(tenantIds, "google_analytics")`.
- מחליף את ה-empty state ב-`<NewReportForm />` (קומפוננטה פנימית באותו קובץ).
- `handleCreateReport` חדש שמחליף את `handleFetchFromAhrefs` + `handleCreateTable` ומבצע אותם בזה אחר זה.

### `src/components/dynamic-tables/SeoDashboardView.tsx` (קריאה בלבד, אם צריך)
- אם הוא כבר תומך ב-`gsc_integration_id` / `ga_integration_id` ב-`integration_settings` — שום שינוי. נוודא בזמן הפיתוח (לפי הזיכרון "Unified SEO Report View" זה כבר התנהגות קיימת).

### ללא שינויי DB
- `clients.website` לא מתעדכן.
- `crm_tables.integration_settings` הוא JSONB → אין שינוי סכמה.

## פרטים טכניים

- `list-ahrefs-projects` כבר קיים כ-edge function ומחזיר את רשימת הפרויקטים מה-API של Ahrefs.
- ה-GSC/GA integrations נטענים דרך ה-hook הקיים `useUserIntegrations` שמחזיר גם חיבורים אישיים וגם משותפים — בדיוק כפי שהזיכרון `per-user-google-connections` דורש.
- בחירת GSC site / GA property נעשית מתוך `settings.available_sites` / `settings.available_properties` של החיבור הנבחר, ללא קריאת רשת נוספת.
- ולידציה: כפתור "צור" disabled עד שיש (domain || ahrefs_project) + לפחות מקור אחד נבחר.
