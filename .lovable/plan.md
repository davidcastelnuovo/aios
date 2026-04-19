
## הסיבה לפער (זו לא תקלה - זה דוח שגוי)

הצילום שלך מ-GA4 מראה במפורש בכותרת:
> **Traffic acquisition: Session primary channel group**

זה אומר שהדוח שאתה רואה ב-GA4 משתמש ב-dimension **`sessionDefaultChannelGroup`** — סשנים מסווגים לפי הערוץ שהביא אותם **באותו ביקור**.

הסנכרון שלנו ב-`sync-google-analytics-data` (שורה 211) משתמש ב:
```ts
dimensions: [{ name: 'date' }, { name: 'firstUserDefaultChannelGrouping' }]
```

זה דוח **שונה לחלוטין** ב-GA4 — זה ה-**"User acquisition"** (איך המשתמש הגיע **בפעם הראשונה** אי פעם), לא Traffic Acquisition. שני הדוחות תמיד מראים מספרים שונים, גם בתוך GA4 עצמו.

## דוגמה מהנתונים שלך (7 ימים אחרונים)

| ערוץ | GA4 (Traffic Acquisition - מה שאתה רואה) | אצלנו היום (User Acquisition) |
|------|---|---|
| Organic Social | 5,834 | 152 |
| Direct | 1,103 | 28 |
| Paid Social | 970 | 61 |

ההבדל ענק כי הסיווג ב-User Acquisition "תוקע" משתמש לקטגוריה הראשונה שבה הגיע אי פעם, לעומת Traffic Acquisition שמסווג כל סשן בנפרד.

## התיקון

### 1. החלפת ה-dimension בסנכרון
ב-`supabase/functions/sync-google-analytics-data/index.ts`, ב-`channelGroupRequest` (שורות 209-229):
- להחליף `firstUserDefaultChannelGrouping` → **`sessionDefaultChannelGroup`**
- להחליף את שם ה-`report_type` שלו ל-`channel_group` (נשאר אותו דבר), והנתונים יישמרו לאותו מקום בדיוק.

זה ייצור התאמה 1:1 לדוח Traffic Acquisition שאתה רואה ב-GA4.

### 2. סנכרון מחדש לדהר
לאחר התיקון אפעיל סנכרון מלא לטבלת `082cbae0-22bd-4e76-9e7f-d2c1bd6e5927` (לידר GA), כדי שהנתונים החדשים יחליפו את הישנים מיד.

### 3. בונוס - לא להריץ דוח שלא משתמשים בו
דוח 5 (Channel Group) הוא היחיד שהשתמש ב-User Acquisition בטעות. כל שאר הדוחות (`trafficData`, `dailyData`, `dailySourceData`) משתמשים ב-`sessionSourceMedium` שזה הצד הנכון (per-session). אז אחרי השינוי הזה — כל הסנכרון יהיה מיושר עם מה שאתה רואה ב-GA4.

## קבצים שיתעדכנו
- `supabase/functions/sync-google-analytics-data/index.ts` — שורה 211 (החלפת dimension) + סנכרון מחדש לטבלה של לידר.

## תוצאה צפויה
Organic Social אצלנו לתקופה של 7 ימים ייתן ערך בסביבות 5,800 (לא 152), Direct יקפוץ לסביבות 1,100, וכך גם שאר הערוצים — בדיוק כמו ב-Traffic Acquisition של GA4.
