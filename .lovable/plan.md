
מובן. בדקתי את הזרימה בפועל, והבעיה עכשיו נראית יותר נקודתית וברורה:

### הבעיה המדויקת
בדוח ה-SEO המרכזי, רכיב `GscIntegration` כן יודע למשוך נתוני GSC במצב `hideTable`, אבל הוא מעביר אותם ל-`SeoDashboardView` רק מתוך `queryFn` של React Query (`onMultiPeriodLoaded` / `onDataLoaded`).

זה יוצר באג חשוב:
- אם ה-query נטען מחדש מהשרת — הנתונים עוברים למעלה, והטבלה מתעדכנת.
- אבל אם React Query מחזיר תוצאה מקאש בפתיחה הראשונית של הדוח, `queryFn` לא רץ מחדש, ולכן `SeoDashboardView` לא מקבל `gscData`.
- התוצאה: בטבלת SEO המרכזית רואים רק Ahrefs, ורק אחרי לחיצה על רענון/סנכרון ה-GSC “מופיע”.

כלומר, הבעיה כבר לא רק ברזולוציית האינטגרציה — אלא בזה שה-state של הדוח המרכזי תלוי ב-side effect מתוך query, במקום להסתנכרן גם מה-data עצמו.

### מה אתקן
#### 1. אייצב את הסנכרון בין `GscIntegration` ל-`SeoDashboardView`
אעדכן את `GscIntegration.tsx` כך שהעברת הנתונים להורה (`onDataLoaded` / `onMultiPeriodLoaded`) תתבצע גם דרך `useEffect` שמאזין לנתוני ה-query עצמם, ולא רק מתוך `queryFn`.

בפועל:
- כשה-query של `gsc-multi-period` חוזר מקאש או מ-fetch רגיל — `onMultiPeriodLoaded(result)` ירוץ.
- כשה-query הרגיל של `gsc-keyword-data` חוזר — `onDataLoaded(rows)` ירוץ.
- כך `SeoDashboardView` תמיד יקבל את הנתונים, גם בטעינה אוטומטית מהקאש.

#### 2. אמנע דריסה/איפוס שגוי של `gscData`
אבדוק ואתקן את הסדר שבו `GscIntegration` מאפס ל-`[]` כשאין `effectiveSiteUrl`, כדי שלא יהיה מצב של:
- render ראשון מאפס נתונים,
- ואז query cached קיים אבל לא דוחף אותם חזרה להורה.

המטרה היא שלא יהיה race condition בין reset מוקדם לבין נתוני multi-period שכבר זמינים.

#### 3. אשאיר את הדוח המרכזי מבוסס על multi-period בלבד
במצב `hideTable` אמשיך להשתמש ב-`gsc-multi-period` כמקור האמת של הדוח המרכזי, כי זה מה שמעשיר גם את:
- `gscMap`
- `gscOnlyKeywords`
- ההשוואות ל-Prev Month / 3 Months / Yearly

לא אגע בלוגיקה של לשונית Search Console עצמה, כדי לא לשבור את הדוחות האחרים.

#### 4. אשמור על אי-פגיעה בדוחות שכבר עובדים
לא אשנה:
- את מבנה טבלת `SeoKeywordsTable`
- את לוגיקת Ahrefs
- את ה-public shared SEO report
- את מנגנון ה-fallback של GSC מעבר לנדרש

השינוי יהיה ממוקד רק בסנכרון state בין `GscIntegration` לבין `SeoDashboardView`.

### קבצים לעדכון
- `src/components/dynamic-tables/seo/GscIntegration.tsx`
- אם יהיה צורך קטן בלבד לסנכרון בטוח יותר: `src/components/dynamic-tables/SeoDashboardView.tsx`

### בדיקות אחרי המימוש
1. דורון לוין — פתיחת לשונית `SEO` תציג מיד את ביטויי GSC בתוך הטבלה המרכזית, בלי ללחוץ על סנכרון.
2. רענון עמוד מלא — הנתונים עדיין יופיעו אוטומטית.
3. מעבר בין דוחות SEO שונים — לא יישארו נתוני GSC ישנים מדוח קודם.
4. לשונית `Google Search Console` תמשיך לעבוד כרגיל.
5. דוחות SEO אחרים שכבר עובדים — ללא רגרסיה.

### מה כנראה יפתור את זה סופית
הבעיה נראית כרגע כבעיה של hydration/cache synchronization, לא של חוסר נתונים. לכן התיקון הזה הוא הממוקד ביותר כדי ש-GSC יופיע אוטומטית בטבלה עצמה, בדיוק כפי שאתה מבקש.
