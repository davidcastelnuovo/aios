
המשתמש אומר:
- "אנטרקטיקה" — Google Ads מציג 1 המרה (ולא 6 כמו שאני ראיתי קודם). אז המספר 6 שהמערכת מציגה שגוי.
- "צפון הודו" — Google Ads מציג 1 המרה אבל בפועל היו 8 לידים.

יש כאן פער בין:
1. מה ש-Google Ads מציג ב-UI שלהם (נראה שזה המספר ה"נכון" לדעת המשתמש)
2. מה שהמערכת שלנו מציגה אחרי הסנכרון

זה אומר שיש בעיה ב-`sync-google-ads-data` — או שהוא מושך metric שגוי, או שהוא צובר/מכפיל/לוקח attribution אחר.

צריך לבדוק:
1. איזה GAQL query רץ ב-`sync-google-ads-data`
2. איזה שדה conversions הוא בוחר (`metrics.conversions` vs `metrics.all_conversions` vs `metrics.conversions_value`)
3. האם הוא מצרף segments שגורמים לכפילות (segments.date מכפיל לפי תאריך — זה תקין; אבל segments.conversion_action מכפיל לפי כל פעולת המרה — זה הבעיה הפוטנציאלית)

אני צריך לקרוא את הקובץ כדי להציג plan מדויק.

ההשערה הסבירה:
- אם הסנכרון משתמש ב-segments כמו `segments.conversion_action_category` או דומה — זה מכפיל את ה-rows ולכן conversions מצטבר בטעות
- או שהוא משתמש ב-`metrics.all_conversions` במקום `metrics.conversions`
- או שהוא לא מסנן לפי `segments.date` נכון ומקבל overlapping windows

בנוסף, ה-`webhook-google-ads-sync` (שראיתי בהקשר) פשוט מקבל records ושומר. אז הבעיה היא בצד ה-sync שמכין את ה-records ושולח לwebhook (או ישירות ב-edge function אחר).

בנוסף — המשתמש מזכיר שלידים שונים מ-conversions:
- "צפון הודו" — Google מדווח 1, אבל היו 8 לידים אמיתיים
- "אנטרקטיקה" — Google מדווח 1, היה 1 ליד

זה בעצם בעיה אחרת: Google לא יודע לעקוב אחרי כל הלידים (אולי conversion tracking לא מותקן נכון על אחד מהקמפיינים, או שהלידים מגיעים מ-WhatsApp Click שלא נספרים כ-conversion).

אז יש שתי שאלות נפרדות:
1. **באג בסנכרון**: למה אנטרקטיקה מציג 6 אצלנו במקום 1 שגוגל מראה? → זה באג טהור.
2. **גישה תוצרית**: מה לעשות עם הפער בין conversions של גוגל לבין מספר הלידים בפועל ב-CRM?

ל-(1) צריך לתקן את הסנכרון.
ל-(2) צריך להחליט: להציג גם "המרות גוגל" וגם "לידים בפועל ב-CRM" כדי שיראו את הפער.

צריך לקרוא את `sync-google-ads-data` כדי להבין:

הסקירה הראשונית מספיקה לי להבין שצריך לבדוק את הסנכרון. אכין plan קצר.

## הבעיה בקצרה

יש כאן שני דברים שונים, וצריך לתקן את שניהם:

### 1) באג בסנכרון של Google Ads
- "אנטרקטיקה" — גוגל באמת מראה **1 המרה**, אבל אצלנו רשום **6**.
- זה אומר שהסנכרון שלנו (`sync-google-ads-data`) מקבל מגוגל מספר שונה ממה שגוגל מציג ב-UI שלו.

הסיבה הסבירה היא שה-GAQL query שלנו משתמש ב-segment שגורם לכפילויות:
- שימוש ב-`segments.conversion_action` או `segments.conversion_action_category` — מפצל את ה-rows לפי כל סוג המרה ואז סוכמים ומקבלים יותר מדי
- שימוש ב-`metrics.all_conversions` במקום `metrics.conversions` — סופר גם cross-device ו-view-through
- שימוש ב-attribution model שונה מה-default של ה-UI

### 2) פער בין "המרות לפי גוגל" ל"לידים בפועל ב-CRM"
- "צפון הודו" — גוגל מדווח 1, אבל באמת נכנסו 8 לידים ל-CRM.
- זה לא באג בסנכרון; זה אומר ש-conversion tracking של הקמפיין הזה לא תופס את כל הלידים (למשל לידים מ-WhatsApp click לא נספרים, או שה-tag לא הותקן/הופעל נכון).

## מה אני מתכנן לעשות

### שלב א — לתקן את הסנכרון כך שיתאים בדיוק למה שגוגל מציג
1. לקרוא את `supabase/functions/sync-google-ads-data/index.ts` ולוודא:
   - שה-query לא משתמש ב-segments שמייצרים כפילויות (להסיר `segments.conversion_action*`)
   - שמשתמשים ב-`metrics.conversions` ולא ב-`metrics.all_conversions`
   - שהאגרגציה לפי `campaign + date` בלבד (ללא segments נוספים)
2. להריץ סנכרון מחדש לארגון ולוודא שהמספר של "אנטרקטיקה" יורד מ-6 ל-1, בהתאמה ל-UI של גוגל.

### שלב ב — להוסיף עמודה של "לידים בפועל ב-CRM" ליד "המרות"
כדי שתוכל לראות במקום אחד גם:
- **המרות** — כמו שגוגל מדווח (לאחר התיקון יהיה תואם ל-UI שלו)
- **לידים ב-CRM** — ספירה מתוך טבלת `leads` של אותו קמפיין באותם תאריכים

ככה תוכל לראות מיד באיזה קמפיין יש פער ואיפה צריך לבדוק את ה-tracking בגוגל.

### שלב ג — לחקור את "צפון הודו"
לבדוק למה גוגל לא תופס שם את כל הלידים:
- האם conversion tracking מותקן/פעיל בקמפיין הזה?
- האם הלידים מגיעים מ-channel שלא נספר כ-conversion (למשל WhatsApp click במקום form submit)?
- האם יש מיפוי שגוי של conversion action?

זה דורש בדיקה מעבר לקוד, אבל אעזור לאבחן אחרי שהתיקון בשלב א' יוצא לדרך.

## קבצים שיושפעו
- `supabase/functions/sync-google-ads-data/index.ts` — תיקון GAQL query והסרת segments שגורמים לכפילות
- `src/components/dynamic-tables/SeoReportTabs.tsx` או הקומפוננטה של דוח Google Ads — הוספת עמודה "לידים ב-CRM" (אזהה את הקובץ המדויק לאחר אישור)

## ללא שינויי DB
לא נדרש שינוי טבלאות. רק תיקון לוגיקת סנכרון + תוספת עמודת תצוגה.

## פירוט טכני קצר
שורש הבאג כמעט בוודאות הוא ב-GAQL: כשמוסיפים `segments.X` ל-SELECT, גוגל מחזיר row לכל ערך של ה-segment, וה-`metrics.conversions` מתחלק בין השורות. אם הקוד שלנו עושה SUM עליהם — מקבלים פעמיים-שלוש את אותה המרה. הפתרון הוא:
- להסיר segments מיותרים מה-SELECT
- לקבץ אך ורק לפי `campaign.id + segments.date`
- להשתמש ב-`metrics.conversions` (לא `all_conversions`)
