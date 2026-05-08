## הבעיות

**1. בדו"ח ה-SEO בקישור השיתוף עדיין מופיע גרף Ahrefs במקום Maskyoo**
בדשבורד הפנימי (`SeoDashboardView`) כבר הוחלף גרף ה-Ahrefs בכרטיס Maskyoo (שורות 606–615), אך ב-`PublicSeoView` (השיתוף) עדיין מרונדר `<SeoTrafficChart trafficHistory={trafficHistory} />` (שורה 253) — וזה מה שמציג את גרף ה-Ahrefs.

ב-`SharedDashboard` ו-`SharedTable` כבר יש `PublicMaskyooCallsCard` *מעל* `PublicSeoView`, אז ה-Maskyoo כן מוצג, אבל גם גרף ה-Ahrefs ממשיך להופיע בתוך `PublicSeoView` — בדיוק תופעת הכפילות שהמשתמש מתאר.

**2. ברירת המחדל של טווח התאריכים בדשבורד השיתוף היא 7 ימים אחרונים, ולא 30**
`src/pages/SharedDashboard.tsx` שורה 116:
```ts
const [dateFilter, setDateFilter] = useState('last_7_days');
```

## התיקון

### `src/components/dynamic-tables/PublicSeoView.tsx`
- להסיר את הרינדור של `<SeoTrafficChart trafficHistory={trafficHistory} />` (שורה 253) ואת ה-import שלו (שורה 9).
- כך הקישור המשותף יהיה זהה לדשבורד הפנימי: כרטיס Maskyoo במקום הגרף, ואז כרטיסי snapshot ⇒ טבלת מילות מפתח.
- הפרופ `gaOrganicByMonth` שכבר לא בשימוש יוסר מהממשק (אופציונלי, ניקוי).

### `src/pages/SharedDashboard.tsx`
- שינוי שורה 116:
```ts
const [dateFilter, setDateFilter] = useState('last_30_days');
```

## אימות

לאחר היישום, ברענון ב-`/share/dashboard/...`:
- טאב SEO יראה: `PublicMaskyooCallsCard` → snapshot cards → טבלת מילות מפתח (זהה לדשבורד הפנימי, ללא גרף Ahrefs).
- ברירת המחדל של ה-Date Picker למעלה תהיה "30 יום אחרונים".
