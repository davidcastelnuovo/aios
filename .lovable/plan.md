

## הבעיה
ב-`ClientDashboardPanel` הצילום מבוסס iframe — הוא טוען את עמוד הדשבורד בתוך iframe ומצלם אותו. התוצאה לא נאמנה: לפעמים הנתונים לא מספיקים להיטען, סטיילים נשברים, והפלט שונה מהדשבורד המקורי.

ב-`ClientReportPanel` (טבלאות בודדות) הפתרון אחר ועובד: רכיב snapshot ייעודי (`SeoCombinedSnapshot` / `ClientReportSnapshot`) שמושך את הנתונים ישירות מה-DB ומרנדר אותם בעיצוב נאמן למקור — ללא iframe — ואז `toPng` מצלם אותו דרך React Portal.

## הפתרון
להחיל את אותה ארכיטקטורה גם על דשבורד הלקוח: לבטל את ה-iframe, ולרנדר את התוכן האמיתי של הדשבורד דרך הרכיבים הקיימים (אותם הרכיבים שעמוד `DashboardView` משתמש בהם), בתוך פורטל מוסתר, ולצלם משם.

### שינויים

**1. `src/components/clients/ClientDashboardSnapshot.tsx` (חדש)**
רכיב snapshot ייעודי לדשבורד שמקבל `dashboardId`, `clientId`, `tenantId`, `tab` (`all` / `facebook` / `google_ads` / `seo`).
- מושך את אותם נתונים ש-`DashboardView` מושך (טבלאות + רשומות לפי `dashboard.client_id`).
- מרנדר את אותו פלט ויזואלי כמו ב-`DashboardView` באמצעות שימוש חוזר ברכיבים הקיימים:
  - לטאב `seo`: `<SeoDashboardView />` (אותו רכיב שכבר משמש בעמוד)
  - לטאב `google_analytics`: `<GoogleAnalyticsDashboard />`
  - לטאבים `all` / `facebook` / `google_ads`: כרטיסי KPI + טבלאות summary (העתקת בלוק ה-summary cards מ-`DashboardView` שכבר מוכן ובדוק)
- כותרת עליונה זהה למקור: שם הלקוח + שם הדשבורד.
- רוחב קבוע (`1200px`) רקע לבן — כדי שהצילום ייצא בפרופורציות אחידות.

**2. `src/components/clients/ClientDashboardPanel.tsx`**
- להוריד את ה-iframe ואת `iframeRef` / `iframeLoaded`.
- להחזיק `snapshotRef` כמו ב-`ClientReportPanel`.
- לרנדר את `<ClientDashboardSnapshot ref={snapshotRef} ... tab={activeTab} />` דרך `createPortal` ב-`document.body` במיקום מוסתר (`left:-9999, opacity:0`).
- `captureScreenshot` יקרא ל-`toPng(snapshotRef.current)` במקום לקרוא ל-iframe.
- להציג בעמוד עצמו תצוגה מקדימה של הצילום (`<img src={screenshotUrl} />`) במקום ה-iframe — בדיוק כמו ב-`ClientReportPanel`.
- לחיצה על טאב מחליפה את ה-`tab` שמועבר ל-snapshot, ואז Capture חדש.

**3. סנכרון שמות עם הסטנדרט הקיים**
- `CACHE_KEY_PREFIX` נשאר `dashboard-screenshot-` עם cache key לפי `dashboardId + tab` (כדי שלא יערב צילום בין טאבים).

### תוצאה
- הצילום של הדשבורד יראה **בדיוק** כמו ה-Live View שבעמוד `DashboardView` (אותם רכיבים, אותם נתונים, אותו עיצוב).
- ללא iframe → אין בעיות של טעינה אסינכרונית, סטיילים חסרים, או cross-document.
- אותה ארכיטקטורה כמו ב-SEO/Facebook/Google Ads בודד שכבר עובד.

