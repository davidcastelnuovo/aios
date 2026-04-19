

## ההבנה
בדוח SEO (ראש העמוד עם 8 הכרטיסים), הכרטיס "תנועה אורגנית" מציג כרגע ערך מ-Ahrefs (440 בתמונה — הוא מסומן "הערכת Ahrefs" גם בגרף למטה). המשתמש רוצה שהוא יציג את **התנועה האורגנית האמיתית מ-Google Analytics**, לא הערכה מ-Ahrefs.

## חקירה נדרשת
לקרוא את `SeoReportTabs.tsx` (או הקומפוננטה שמציגה את כרטיסי ה-overview של דוח ה-SEO) ולמצוא את הכרטיס "תנועה אורגנית" + הגרף "הערכת Ahrefs". אחר כך להחליף את המקור ל-GA: `sessions` (או `users`) שבהם `sessionDefaultChannelGroup = 'Organic Search'`.

## התיקון המוצע
1. **כרטיס "תנועה אורגנית"** — לקבל את הנתון מ-GA במקום מ-Ahrefs:
   - שאילתה ל-GA עם dimension `sessionDefaultChannelGroup` ו-metric `sessions` (או `activeUsers`), מסונן ל-`Organic Search` בלבד.
   - תקופה: לפי טווח התאריכים שכבר נבחר בדוח (אם אין — ברירת מחדל של 30 יום שמסתיימים אתמול, לפי הסטנדרט המערכתי).
   - אם GA לא מחובר ללקוח → להציג fallback ל-Ahrefs עם תווית קטנה ("הערכת Ahrefs — GA לא מחובר") כדי שלא תהיה רגרסיה.
2. **גרף "תנועה אורגנית"** מתחת לכרטיסים — להחליף גם אותו לנתוני GA חודש-אחר-חודש (Organic Search sessions) במקום הערכת Ahrefs. כותרת תשתנה ל-"תנועה אורגנית — Google Analytics".
3. **המקור הקיים מ-Ahrefs** — נשאר זמין רק כ-fallback אם אין חיבור GA.

## קבצים שיתעדכנו (צפוי)
- `src/components/dynamic-tables/SeoReportTabs.tsx` — מקור הנתון של הכרטיס + הגרף "תנועה אורגנית".
- אולי `src/components/dynamic-tables/GoogleAnalyticsDashboard.tsx` או hook ייעודי — שימוש חוזר בלוגיקת השליפה הקיימת של GA Organic.
- ללא שינוי DB. ללא שינוי ב-edge functions של Ahrefs. אם נדרשת שאילתה חדשה ל-GA לפי channel — שימוש ב-edge function הקיימת `sync-google-analytics-data`/`fetch-google-analytics` (אבדוק איזו רלוונטית).

## פירוט טכני
- GA Data API: `dimensions: [{name: 'sessionDefaultChannelGroup'}]`, `metrics: [{name: 'sessions'}]`, `dimensionFilter: {filter: {fieldName: 'sessionDefaultChannelGroup', stringFilter: {value: 'Organic Search'}}}`.
- לגרף: להוסיף גם dimension `yearMonth` כדי לקבל סדרה לאורך זמן.
- הטווח של הגרף: כמו היום (24 חודשים אחרונים), אבל מ-GA. אם ל-GA אין נתונים לחודש מוקדם (חיבור חדש) — נציג רק את החודשים שיש להם נתונים.

## פרסום מחדש
לאחר התיקון נדרש **לפרסם מחדש** כדי שהשינוי יחול גם ב-`after-lead.com` ובדשבורד הציבורי.

