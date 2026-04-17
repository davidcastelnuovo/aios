
## הבעיה
ב-`GscIntegration.tsx` (שורות 160-184), כשמשתמש בוחר אתר GSC ללקוח X, הקוד שומר את הבחירה ב-3 מקומות:
1. `client_sites[clientId]` (נכון — פר-לקוח)
2. `settings.site_url` (גלובלי — **באג**)
3. `settings.siteUrl` (גלובלי — **באג**)

מאחר שהקריאה (שורה 87) נופלת חזרה ל-`settings.site_url` כשאין רישום פר-לקוח, **כל לקוח חדש שעדיין לא הוגדר לו אתר רואה את האתר של הלקוח שנבחר אחרון** → "מתעדכן רוחבית בכל הלקוחות".

בנוסף, השיוך לא נשמר על דוח ה-SEO עצמו (טבלת Ahrefs) אלא רק על האינטגרציה הגלובלית — לכן אם משתפים את חיבור ה-GSC בין משתמשים או מסנכרנים מחדש, השיוך עלול לאבד את ההקשר של הדוח הספציפי.

## הפתרון

### 1. תיקון הדליפה הרוחבית (`GscIntegration.tsx`)
- **הסרת הכתיבה ל-`site_url`/`siteUrl` הגלובליים** ב-`updateSiteMutation`. נשמור רק את `client_sites[clientId]` (וגם `available_sites` לקאש).
- **הסרת ה-fallback ל-`settings.site_url`/`settings.siteUrl`** בקריאה (שורה 87). אם אין רישום פר-לקוח → לא נציג אתר אוטומטית מבחירה ישנה של לקוח אחר.
- **שמירה אוטומטית פר-דומיין**: כשאין `client_sites[clientId]` והדומיין של הדוח (prop `domain`) מתאים בדיוק לאחד מהאתרים הזמינים → לבחור אותו ולשמור אוטומטית ב-`client_sites[clientId]`. זה מממש את "אתה יכול לבד לקשר לפי הדומיין".

### 2. שמירה כפולה גם על דוח ה-SEO (`SeoReportTabs.tsx`)
- כשמשתמש בוחר אתר GSC או טבלת GSC, לשמור את ה-`siteUrl` גם ב-`integration_settings.linkedGscSiteUrl` של טבלת ה-Ahrefs (בנוסף ל-`linkedGscTableId` הקיים).
- להעביר את הערך הזה כ-prop `domain`/initial selection ל-`GscIntegration` כדי שהבחירה תהיה דביקה לדוח עצמו.

### 3. בחירה אוטומטית לפי דומיין (Auto-link)
ב-`GscIntegration.tsx`, `useEffect` חדש: אם יש `domain` מהדוח ויש התאמה ב-`availableSites` (השוואה מנורמלת — מסיר `sc-domain:`, `https://`, `www.`) ועדיין אין `client_sites[clientId]` → בצע `updateSiteMutation` אוטומטית לאתר המתאים.

## קבצים שיעודכנו
- `src/components/dynamic-tables/seo/GscIntegration.tsx` — הסרת דליפה גלובלית + auto-link לפי דומיין
- `src/components/dynamic-tables/SeoReportTabs.tsx` — שמירת `linkedGscSiteUrl` על טבלת ה-Ahrefs

## תוצאה למשתמש
- כל לקוח שומר את אתר ה-GSC שלו בנפרד — אין עוד "התעדכנות רוחבית".
- לאחר שיוך פעם אחת — נשמר לתמיד על הדוח.
- אם הדומיין בדוח Ahrefs תואם לנכס ב-GSC — שיוך אוטומטי בלי התערבות ידנית.

## הערת זיכרון
לאחר היישום אעדכן את `mem://features/integrations/google-search-console-seo-sync` כך שיתעד שכל בחירת אתר GSC חייבת להיות פר-לקוח (`client_sites[clientId]`) ואסור לכתוב ל-`settings.site_url` הגלובלי כדי למנוע דליפה בין לקוחות.
