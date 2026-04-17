
המשתמש בחר אופציה ב' עם דגש על שילוב: הצילום יציג את **שתי המקורות יחד** — Ahrefs Top 10 + GSC Top 10 בתצוגה משולבת.

## מה ייבנה

צילום הדוח בכרטיס הלקוח יוחלף בצילום אמיתי של רכיב `SeoReportTabs` במצב snapshot, שיציג בדף אחד את שני בלוקי ה-Top 10:
1. **Ahrefs Top 10** (מילות מפתח אורגניות מובילות + מיקומים)
2. **GSC Top 10** (שאילתות עמוד ראשון מ-Google Search Console)

## שינויים בקבצים

### 1. `src/components/dynamic-tables/seo/SeoReportTabs.tsx`
הוספת prop חדש:
- `snapshotMode?: boolean` — כשפעיל:
  - מסתיר את ה-TabsList (לא מציג כפתורי טאבים)
  - מסתיר כפתורי פעולה (סנכרון, שיתוף, +)
  - מרנדר תצוגה מאוחדת: Ahrefs Top 10 למעלה + GSC Top 10 למטה (שני בלוקים זה תחת זה)
  - ללא בוררי טבלאות

### 2. `src/components/dynamic-tables/SeoDashboardView.tsx`
הוספת prop `snapshotMode` שיגביל לתצוגת Top 10 בלבד עבור Ahrefs (ללא השוואות, ללא טאבים פנימיים).

### 3. `src/components/dynamic-tables/seo/GscIntegration.tsx`
הוספת prop `snapshotMode` שיציג רק את טבלת ה-Top 10 (עמוד ראשון), ללא כפתורי שפה/חיפוש/סנכרון.

### 4. `src/components/clients/ClientReportPanel.tsx`
החלפת לוגיקת זיהוי דוח SEO:
- במקום לרנדר `ClientReportSnapshot`, לרנדר off-screen את `<SeoReportTabs snapshotMode tenantId clientId />`
- להמתין ~5 שניות לטעינת GSC + Ahrefs
- לצלם עם html2canvas
- לאפס cache בעת מעבר בין טבלאות (כבר קיים)

### 5. `src/components/clients/ClientReportSnapshot.tsx`
להישאר כ-fallback בלבד אם הצילום החי נכשל (loader: "טוען צילום עדכני…").

## תוצאה
כרטיס הלקוח יציג צילום זהה לחלוטין למה שמופיע בדוח החי — שני בלוקים מאוחדים: **Ahrefs Top 10** + **GSC Top 10** עם אותם מספרים, אותו עיצוב, אותם נתונים.
