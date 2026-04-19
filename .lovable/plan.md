

## הבעיה — כפילות במנגנון צילום הדוח

### מה קורה היום
יש **שני מנגנוני צילום שונים** לאותו דוח:

**1. מתוך הדוח עצמו (`DynamicTableView` → `SendReportDialog`)** — עובד מצוין:
- מצלם את `summaryTablesRef` (ה-DOM החי של הדוח עצמו, עם הסינון/טווח התאריכים שהמשתמש בחר).
- `toPng({ pixelRatio: 2, quality: 0.95 })` ישירות על אזור הטבלאות המסכמות.
- תוצאה: צילום מדויק של מה שהמשתמש רואה.

**2. מתוך כרטיס הלקוח (`ClientTablesTab` → `ClientReportPanel` → `ClientReportSnapshot`)** — בעייתי:
- מרנדר רכיב **שונה לחלוטין** (`ClientReportSnapshot.tsx` — 506 שורות של תבנית עצמאית עם לוגיקה משלו ל-leads/ecommerce, KPIs, ועיצוב).
- צריך לסנכרן נתונים, להמתין 3-6 שניות, ואז לצלם תבנית מקבילה.
- כל באג שהיה (כמו איריס גייר באיקומרס) נובע מכך שהתבנית הזאת לא מסונכרנת עם הדוח האמיתי.

### למה זו בעיה
- **תחזוקה כפולה** — כל שינוי בעיצוב הדוח חייב להיעשות פעמיים.
- **חוסר עקביות** — מה שמופיע בכרטיס הלקוח שונה ממה שמופיע בדוח עצמו.
- **באגים חוזרים** — `ClientReportSnapshot` ממציא לבד את הזיהוי של leads/ecommerce במקום להשתמש בקוד של הדוח האמיתי.

---

## הפתרון

**להשתמש באותו מנגנון של הדוח האמיתי גם בכרטיס הלקוח** — לרנדר את `DynamicTableView` בתוך פורטל מוסתר ולצלם ממנו (בדיוק כפי שעושים ב-`ClientDashboardPanel` עם `SharedDashboard`).

### השלבים

**1. יצירת `ClientTableSnapshot.tsx` חדש (בדומה ל-`ClientDashboardSnapshot`)**
- רכיב פשוט שמרנדר את `DynamicTableView` בעצמו (או את ה-`SharedTable` אם קיים) עם `tableId` כ-prop.
- עוטף ב-`QueryClientProvider` נפרד כדי לא להתערב ב-cache של האפליקציה.
- רוחב קבוע 1200px, רקע לבן.

**2. בדיקה אם קיים `SharedTable` page**
- לבדוק אם יש view ציבורי של טבלה (כמו `SharedDashboard`) — אם כן, להשתמש בו.
- אם לא — להשתמש ב-`DynamicTableView` עם prop חדש `embedMode` שמסתיר UI מיותר (סייד-בר, פילטרים, כפתורים) ומציג רק את `summaryTablesRef`.

**3. עדכון `ClientReportPanel.tsx`**
- להחליף את `<ClientReportSnapshot ref={snapshotRef} ...>` ב-`<ClientTableSnapshot ref={snapshotRef} tableId={table.id} />`.
- לשמור את הלוגיקה של ה-portal המוסתר (`position: fixed; left: -9999px`).
- לשמור את כל לוגיקת השליחה (וואטסאפ/אימייל/share link) — היא עובדת.
- להסיר את כל הסנכרון הידני המוקדם של queries מסוג `client-report-data` — כי `DynamicTableView` יסנכרן בעצמו.

**4. מחיקת הקוד הכפול**
- אחרי שמוכח שזה עובד — למחוק את `ClientReportSnapshot.tsx` (506 שורות מיותרות).

### תוצאה צפויה

- **צילום בכרטיס הלקוח = צילום מתוך הדוח** — בייט-בייט.
- כל באג שתוקן בדוח (כמו leads vs ecommerce של איריס) ישתקף אוטומטית בכרטיס הלקוח.
- אין יותר כפילות תחזוקה.
- מהירות זהה (ה-portal מוסתר וה-render מקבילי).

### קבצים מושפעים
- **חדש:** `src/components/clients/ClientTableSnapshot.tsx`
- **עדכון:** `src/components/clients/ClientReportPanel.tsx` — החלפת רכיב ה-snapshot.
- **אופציונלי:** `src/pages/DynamicTableView.tsx` — הוספת prop `embedMode` להסתרת UI לא רלוונטי בצילום.
- **מחיקה:** `src/components/clients/ClientReportSnapshot.tsx` (אחרי וידוא תקינות).

