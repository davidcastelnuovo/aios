
## הבעיה

מסנן השפה בטבלת ביטויי החיפוש של GSC (`עברית/English/הכל`) הוא state מקומי בלבד (`useState`) ב-`GscQueriesTable` בתוך `src/components/dynamic-tables/seo/GscIntegration.tsx`. כל רענון/ניווט/פתיחה אצל אדם אחר — חוזר ל-`"all"`.

בנוסף, ה-`SearchConsoleDashboard` (הטבלה הנפרדת שמופיעה כשיש GSC table מקושר ל-SEO) **כלל לא כוללת** מסנן שפה — אז ההעדפה שנבחרה ב-GscIntegration כלל לא מועברת לתצוגה השמורה / שיתוף.

## הפתרון

### 1. שמירת בחירת השפה כברירת מחדל ברמת הדוח

נוסיף שדה `linkedGscLangFilter` ל-`integration_settings` של ה-SEO table (אותו דפוס בדיוק כמו `linkedGscSiteUrl`).

**ב-`SeoReportTabs.tsx`:**
- לקרוא: `savedGscLangFilter = integration_settings?.linkedGscLangFilter || 'all'`
- להעביר prop חדש `initialLangFilter={savedGscLangFilter}` ל-`GscIntegration` ול-`SearchConsoleDashboard`.
- להעביר callback `onLangFilterChange={(v) => saveLinkMutation.mutate({ key: 'linkedGscLangFilter', value: v })}`.

### 2. עדכון `GscIntegration.tsx` (`GscQueriesTable`)

- להוסיף props ל-`GscQueriesTable`: `initialLangFilter`, `onLangFilterChange`.
- אתחול `useState<LangFilter>(initialLangFilter ?? 'all')`.
- בכל קליק על כפתור — לקרוא ל-`onLangFilterChange(value)` (שמירה אוטומטית ל-DB).

### 3. עדכון `SearchConsoleDashboard.tsx`

- להוסיף את אותו מסנן 3-כפתורים (`הכל / עברית / English`) מעל הטבלה — לוגיקה זהה (`HEBREW_REGEX`, `ENGLISH_REGEX`).
- לקבל `initialLangFilter` ו-`onLangFilterChange` כ-props (אופציונליים).
- לסנן את שורות הטבלה לפי המצב הנוכחי.

### 4. תמיכה בקישור השיתוף הציבורי

ה-`PublicSeoView` הנוכחי לא מציג טבלת GSC keywords. אם יש שיתוף דשבורד ציבורי שכן מציג את ה-GSC table:
- ה-`SearchConsoleDashboard` (שמתבצעת בו ההצגה) יקבל את `initialLangFilter` מתוך ה-`integration_settings` הציבורי שכבר חוזר מ-`public-dashboard` edge function.
- במצב ציבורי — לא נעביר `onLangFilterChange` (קריאה בלבד), כך שהמשתמש החיצוני יראה כברירת מחדל את השפה ששמרתי, ויכול לעבור בין שפות מקומית באותה סשן.

## קבצים שיתעדכנו

- `src/components/dynamic-tables/SeoReportTabs.tsx` — קריאת/שמירת `linkedGscLangFilter` והעברתו ל-2 הילדים.
- `src/components/dynamic-tables/seo/GscIntegration.tsx` — `GscQueriesTable` יקבל `initialLangFilter` + `onLangFilterChange`.
- `src/components/dynamic-tables/SearchConsoleDashboard.tsx` — הוספת מסנן שפה (3 כפתורים) + props חדשים.

## תוצאה

- בחירת `עברית` נשמרת מיידית ב-DB (ב-`integration_settings.linkedGscLangFilter`).
- ברענון, פתיחה ע"י משתמש אחר באותו ארגון, או קישור שיתוף — הטבלה תיפתח כברירת מחדל בשפה שנבחרה.
- עובד בשני נתיבי הצגה (`GscIntegration` חי + `SearchConsoleDashboard` משולחן שמור).
