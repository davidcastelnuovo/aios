
## מה קרה ולמה זה השתנה
זו רגרסיה מהשינויים האחרונים, ובפועל קרו כאן שני דברים שונים:

1. **ב-SEO המשולב החליפו את המיקום של Ahrefs במיקום של GSC**  
   ב-`SeoDashboardView.tsx` יש כרגע קוד שמגדיר:
   - `position = gsc_position` אם קיים
   - ורק אם אין GSC הוא נופל חזרה ל-Ahrefs  
   כלומר במקום "לשלב" — המערכת התחילה **להחליף**.

2. **הלשונית של Google Search Console לא נקבעת באותה לוגיקה של השילוב עצמו**  
   `SeoDashboardView` מושך GSC דרך `GscIntegration` + `useUserIntegrations`,  
   אבל `SeoReportTabs` מחליט אם להציג לשונית GSC לפי בדיקה אחרת (`tenant_integrations` / `gscTables`).  
   לכן יכול להיות מצב ש:
   - נתוני GSC כן נטענים ומשולבים בטבלת ה-SEO
   - אבל לשונית GSC עצמה לא מוצגת

3. **בחלק מהמסכים הוחלף בכלל ה-render של דוח SEO**  
   ב-`DashboardView.tsx` ה-SEO tab מרנדר `SeoDashboardWithGa` במקום `SeoReportTabs`, ולכן שם נעלמו הלשוניות של GSC/Analytics.

## מה אתקן
אחזיר את ההתנהגות שהייתה ועבדה טוב: **גם Ahrefs וגם Google Search Console ביחד, בלי להחליף אחד את השני**.

### שלב 1 — להחזיר את Ahrefs כמקור הראשי בדוח SEO
- לא לדרוס יותר את `position` של Ahrefs עם `gsc_position`
- לשמור את Ahrefs כמיקום הראשי בדוח ה-SEO
- להציג את נתוני GSC **בנוסף**:
  - מיקום ממוצע GSC
  - קליקים
  - חשיפות
  - CTR
- להשאיר `GSC-only keywords` כמו היום

### שלב 2 — להחזיר את לשונית Google Search Console בצורה עקבית
- לאחד את תנאי ההצגה של לשונית GSC עם אותה לוגיקת גישה שכבר מביאה את נתוני GSC בפועל
- כלומר: אם למשתמש יש גישת GSC והדוח יודע למשוך ממנו נתונים, הלשונית תופיע
- זה ימנע מצב שבו GSC "עובד ברקע" אבל הלשונית נעלמת

### שלב 3 — ליישר גם את מסך הדשבורדים
- לבדוק את `DashboardView.tsx`
- אם צריך, להחזיר שם שימוש ב-`SeoReportTabs` או לעטוף אותו כך שיישאר:
  - SEO
  - Search Console
  - Analytics  
  ולא רק SEO משולב

## קבצים שיתעדכנו
- `src/components/dynamic-tables/SeoDashboardView.tsx`
- `src/components/dynamic-tables/seo/SeoKeywordsTable.tsx`
- `src/components/dynamic-tables/SeoReportTabs.tsx`
- `src/pages/DashboardView.tsx`
- ייתכן גם `src/components/dynamic-tables/SeoDashboardWithGa.tsx` אם יהיה צורך רק לשמור את GA בלי לאבד את מבנה הלשוניות

## תוצאה צפויה אחרי התיקון
- דוח ה-SEO יחזור להיות **משולב**:
  - Ahrefs נשאר
  - GSC נשאר
  - לא מחליפים אחד את השני
- לשונית **Google Search Console** תחזור להופיע באופן עקבי
- בטבלת מילות המפתח יראו בבירור:
  - מיקום Ahrefs
  - נתוני GSC הנלווים
- גם במסך הדוח וגם במסך הדשבורד תהיה אותה התנהגות, בלי פערים

## פירוט טכני קצר
הבעיה המרכזית כרגע היא חוסר עקביות:
- `SeoDashboardView` משתמש ב-GSC בתור overlay enrichment
- `SeoReportTabs` משתמש בלוגיקת availability אחרת
- `DashboardView` בכלל עוקף את `SeoReportTabs`

הפתרון הוא:
- להחזיר **source priority** של Ahrefs בטאב SEO
- להציג GSC כמידע משלים
- להשתמש באותה לוגיקת access/linking גם להצגת הלשונית וגם לטעינת הנתונים

## ללא שינויי DB
לא נדרש שינוי טבלאות או מיגרציות. זה תיקון פרונט-אנד ולוגיקת חיבור בלבד.
