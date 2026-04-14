
# תוכנית: הוספת לשוניות Google Search Console ו-Analytics לדוח SEO

## סקירה
כרגע דוח ה-SEO (Ahrefs) מוצג כעמוד יחיד ב-`DynamicTableView`. המטרה היא להוסיף מערכת לשוניות (Tabs) בתוך תצוגת דוח SEO, כך שהמשתמש יוכל לעבור בין:
1. **SEO (Ahrefs)** — הדוח הקיים
2. **Google Search Console** — נתוני GSC מלאים
3. **Google Analytics** — נתוני אנליטיקס

## איך זה יעבוד
- כשנכנסים לדוח SEO, מעל התוכן תופיע שורת לשוניות
- לשוניות GSC ו-Analytics יופיעו רק אם יש אינטגרציה מחוברת (tenant_integrations) או טבלאות קשורות לאותו לקוח
- הלשונית הראשונה (SEO) תהיה ברירת מחדל

## שינויים טכניים

### 1. יצירת קומפוננטה עוטפת — `SeoReportTabs.tsx`
קומפוננטה חדשה ב-`src/components/dynamic-tables/SeoReportTabs.tsx` שתכיל:
- `Tabs` מ-shadcn/ui עם שלוש לשוניות
- שליפת טבלאות GSC ו-GA קשורות לאותו `clientId`/`tenant_id` מ-`crm_tables`
- הצגת `SeoDashboardView` בלשונית SEO
- הצגת `SearchConsoleDashboard` בלשונית GSC (אם קיימת טבלת GSC ללקוח)
- הצגת `GoogleAnalyticsDashboard` בלשונית Analytics (אם קיימת טבלת GA ללקוח)
- לשוניות שאין להן נתונים יוצגו כלא פעילות או יוסתרו

### 2. עדכון `DynamicTableView.tsx`
- החלפת הרינדור הישיר של `SeoDashboardView` בקומפוננטה החדשה `SeoReportTabs`
- העברת ה-props הקיימים (`tenantId`, `clientId`)

### 3. שליפת טבלאות קשורות
Query חדש שמחפש ב-`crm_tables` טבלאות עם:
- `integration_type = 'google_search_console'` ו-`integration_settings->clientId` תואם
- `integration_type = 'google_analytics'` ו-`integration_settings->clientId` תואם
- באותו `tenant_id`

אם לא נמצאות טבלאות קשורות לפי `clientId`, נחפש לפי `tenant_id` בלבד (כל טבלאות GSC/GA של הטנאנט).

### 4. התאמת `GoogleAnalyticsDashboard`
כרגע הקומפוננטה מקבלת `records` כ-prop. נצטרך לשלוף את הרשומות (`crm_records`) של טבלת ה-GA הרלוונטית ולהעביר אותן.

## קבצים שישתנו
- **חדש**: `src/components/dynamic-tables/SeoReportTabs.tsx`
- **עדכון**: `src/pages/DynamicTableView.tsx` — החלפת `SeoDashboardView` ב-`SeoReportTabs`

## ללא שינויי מסד נתונים
אין צורך בשינויי DB — הנתונים כבר קיימים בטבלאות `crm_tables` ו-`crm_records`.
