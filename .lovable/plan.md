

## הבעיה

צילום הדשבורד היום מצלם את **כל ה-`SharedDashboard`** (KPIs, טבלת פלטפורמות, גרפים, Analytics dashboard, SEO, WooCommerce, וכו'). התוצאה היא תמונה ענקית וצרה שכשמכווצים אותה למייל/וואטסאפ — אי אפשר לקרוא כלום.

המשתמש רוצה שהצילום יכלול **רק את החלק העליון** שמופיע בצילום שצירף:
- **כותרת + טאבים של פלטפורמה** (הכל / Facebook / Google Ads / Analytics / SEO)
- **כרטיסי ה-KPI** (CPL, קליקים, לידים, הוצאה כוללת, סשנים…)
- **טבלת "פירוט לפי פלטפורמה"**

ולעצור שם — בלי הגרפים הארוכים מתחת.

## הפתרון

אסמן את חלק ה-"frame" הרצוי ב-`SharedDashboard` בתור region בעל `data-snapshot-frame="true"`, ואשנה את `captureScreenshot` ב-`ClientDashboardPanel` שיצלם **רק את ה-region הזה** במקום את ה-root כולו.

### 1. סימון ה-frame ב-`SharedDashboard.tsx`

עוטף ב-`<div data-snapshot-frame="true">…</div>` את הבלוק שמתחיל מהטאבים של הפלטפורמה ועד סוף טבלת "פירוט לפי פלטפורמה" (שורות ~595–1083 פלוס בלוק הטבלה ~1086–1183). ה-Header של הדשבורד (שם + לקוח + סוכנות) יישאר מחוץ ל-frame אבל אכלול אותו כדי שיהיה context. למעשה ה-frame יקיף:
- Header (שם דשבורד + לקוח)
- Platform Tabs
- KPI cards
- Platform Breakdown table

ויעצור **לפני** הגרפים (`Trends Over Time`, `Daily Performance Chart`, וכו').

### 2. עדכון לוגיקת הצילום ב-`ClientDashboardPanel.tsx`

ב-`captureScreenshot`:
```ts
const node = snapshotRef.current;
const frame = node?.querySelector('[data-snapshot-frame="true"]') as HTMLElement | null;
const target = frame || node; // fallback ל-node המלא אם ה-frame לא נמצא (למשל ב-SEO/WooCommerce only)
```
ולהעביר את `target` ל-`toJpeg(target, …)` במקום `node`. גם ה-readiness wait + מדידת `getBoundingClientRect` יעבדו על `target`.

### 3. תאימות לאחור

- אם הדשבורד הוא רק SEO / WooCommerce / Analytics (אין `data-snapshot-frame`), נופלים ל-node הרגיל — בדיוק כמו היום.
- אם המשתמש בכל זאת ירצה את הצילום הארוך בעתיד, אפשר להוסיף toggle בעתיד; כרגע נשאר ברירת מחדל "מצומצם".

## תוצאה

- צילום קצר וקריא הכולל רק KPIs + טבלת פלטפורמות.
- תמונה קטנה משמעותית בקילובייטים → אין יותר חששות מ-Gmail 25MB / Green API limits.
- האיכות תהיה טובה כי `pixelRatio` יישאר גבוה (1.5) כש-totalPx קטן.

## קבצים שיתעדכנו

- `src/pages/SharedDashboard.tsx` — עטיפת בלוק ה-KPI/Header/Tabs/Breakdown ב-`data-snapshot-frame="true"`.
- `src/components/clients/ClientDashboardPanel.tsx` — `captureScreenshot` יעדיף לצלם את ה-frame הפנימי במקום את כל ה-node.

## פרטים טכניים

- אין שינוי בסכימה / Edge Functions.
- אין השפעה על `PublicSeoView` / `GoogleAnalyticsDashboard` / `PublicWooCommerceView` (הם נבחרים ב-tab ייעודי וב-frame "All" לא יופיעו בצילום בכל מקרה).
- ה-`isSnapshotReady` נשאר על ה-root כדי שה-poll ימשיך לעבוד; רק יעד ה-`toJpeg` משתנה.

