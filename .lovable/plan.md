

## הבעיה

הביטויים של Google Search Console:
1. **בעמוד הראשי (SEO)** — נטענים חלקית: רק "ביטויים אורגניים" של אהרפס מקבלים העשרה מ-GSC; ביטויים שמופיעים רק ב-GSC ולא באהרפס כן מתווספים, אבל הם מוגבלים ל-`rowLimit: 1000` ב-API ובלי צבירה לפי תקופה (לפעמים חוזרים פחות נתונים בגלל חתך זמן צר).
2. **בקישור השיתוף** — לא נטענים בכלל. ה-`PublicSeoView` (הקומפוננטה שמרנדרת את לשונית "SEO" בשיתוף) פשוט מתעלמת מ-GSC: היא מעבירה `gscOnlyKeywords={[]}` ו-`hasGscData={false}` ל-`SeoKeywordsTable`. נתוני ה-GSC כן מגיעים ב-payload (`data.gsc_records` מהפונקציה `public-table`), אבל רק לשונית "Search Console" הנפרדת משתמשת בהם (`PublicGscView`). הם **לא** מוזרמים לתוך טאב ה-SEO הראשי.

בנוסף, בעמוד המאומת (לא משותף) — `SeoDashboardView` מסתמך על `GscIntegration` שמושך נתונים בלייב מ-API של גוגל (דורש access token של המשתמש המחובר, לא קיים בעמוד שיתוף ציבורי). לכן בקישור שיתוף ה-GSC לעולם לא ייטען בלייב — חייבים להזין אותו מתוך `gsc_records` שכבר נשלפו ב-edge function.

## הפתרון

### 1. הזרמת `gsc_records` כ-`gscData` ל-`PublicSeoView` (שיתוף)

בעמוד `SharedTable.tsx`, במקום לשלוח רק `reports` ל-`PublicSeoView` בטאב ה-SEO, להעביר גם את `gscRecords` המאוגדים לפי keyword (clicks, impressions, ctr, position ממוצע משוקלל לפי impressions — בדיוק כמו ש-`PublicGscView` כבר עושה).

הצבירה תקרה פעם אחת ב-`SharedTable`, ותועבר כ-prop חדש ל-`PublicSeoView`:

```ts
gscData: Array<{ keyword, clicks, impressions, ctr, position }>
```

### 2. עדכון `PublicSeoView` להעשיר ביטויים מ-GSC ולהוסיף "GSC-only"

זהה ללוגיקה הקיימת ב-`SeoDashboardView`:
- בונה `gscMap` מהמערך הנכנס.
- בפונקציית `enrich`, ממלא `gsc_clicks/gsc_impressions/gsc_ctr/gsc_position` מתוך המפה.
- בונה `gscOnlyKeywords` מ-GSC keywords שלא מופיעים באהרפס.
- מעביר ל-`SeoKeywordsTable`:
  ```tsx
  gscOnlyKeywords={gscOnlyKeywords}
  hasGscData={gscData.length > 0}
  ```

זה יראה את אותם הביטויים בדיוק שמופיעים בעמוד המאומת — בלי קריאה ללייב API.

### 3. תיקון "טעינה חלקית" בעמוד המאומת

הסיבה ש-`SeoDashboardView` מציג רק חלק מהביטויים: הקריאה הנוכחית עם `dateRange='28d'` ו-`rowLimit: 1000` מקבלת רק את הביטויים מהחודש האחרון. אבל אהרפס מחזיר ביטויים היסטוריים — אין התאמה ל-keywords ישנים יותר.

תיקון: בקריאה היחידה (current) להגדיל את חלון הזמן לברירת מחדל של **90 יום** במקום 28 יום (כשנקרא במצב `hideTable + onMultiPeriodLoaded` מתוך `SeoDashboardView` — שם רוצים את האיחוד הרחב ביותר). זה כפול-משולש את ה-coverage של keywords ל-merge עם אהרפס.

**הקפדה לא לפגוע במקומות אחרים**: השינוי יחול רק על ה-period `current` של ה-multi-period query (הוא קיים רק כש-`enableMultiPeriod=true`, כלומר רק ב-`SeoDashboardView`). בלשונית "Search Console" הנפרדת ו-`GscIntegration` עם `hideTable=false` הלוגיקה נשמרת זהה (28d/3m/12m לפי הבורר).

### 4. שיפור קטן ל-`fetch-gsc-data`

שמירה על `rowLimit: 1000` (זה המקסימום ה-API מחזיר במכה אחת). כדי לקבל יותר ביטויים, מתבצע pagination בעזרת `startRow`. אפשר לולאה של עד 5 דפים (5,000 ביטויים) רק כשמועבר flag חדש `aggregateAll: true` מהקריאה הראשית של ה-SEO dashboard.

הוספת `aggregateAll: true` בקריאה אחת — מתוך `useQuery` הראשי של `GscIntegration` כשהוא במצב `hideTable + onMultiPeriodLoaded` (מצב "SEO main"). שאר הקריאות נשארות חד-דפיות.

## קבצים שיתעדכנו

- **`src/pages/SharedTable.tsx`** — בלשונית SEO לעבד `gscRecords` למבנה keyword-aggregated ולהעביר ל-`PublicSeoView`.
- **`src/components/dynamic-tables/PublicSeoView.tsx`** — קבלת prop חדש `gscData`, בניית `gscMap`, העשרת `enrich`, יצירת `gscOnlyKeywords`, העברה ל-`SeoKeywordsTable` עם `hasGscData=true`.
- **`src/components/dynamic-tables/seo/GscIntegration.tsx`** — בקריאת `current` של ה-multi-period להעביר `aggregateAll: true` ולהשתמש בחלון של 90 יום (לא משפיע על ה-period maps האחרים).
- **`supabase/functions/fetch-gsc-data/index.ts`** — תמיכה ב-`aggregateAll` (לולאת pagination על `startRow` עד 5,000 שורות, רק כשהדגל מוגדר).

## מה לא ישתנה

- לשונית "Search Console" הנפרדת ב-`SeoReportTabs` — נשארת זהה (משתמשת ב-`SearchConsoleDashboard` או ב-`GscIntegration` רגיל).
- לשונית "Search Console" בקישור שיתוף — `PublicGscView` נשאר זהה.
- בורר השפה (כל/עברית/English) שהוספנו אתמול ב-`GscQueriesTable` ו-`SeoKeywordsTable` — לא נוגעים.
- מנגנון ה-multi-period (prevMonth/3m/yearly) — נשמר זהה.
- אצל לקוחות בלי GSC — אין שינוי בכלל.

## תוצאה צפויה

- **בקישור השיתוף**: לשונית SEO תציג את כל הביטויים, כולל אלה שרק ב-GSC, עם clicks/impressions/CTR — בדיוק כמו בעמוד המאומת.
- **בעמוד המאומת**: כיסוי משמעותית רחב יותר של ביטויים מ-GSC (עד 5,000 מ-90 יום), כך שכל ביטוי באהרפס שגם יש לו תנועה ב-GSC יקבל את ההעשרה ולא יישאר ריק.

