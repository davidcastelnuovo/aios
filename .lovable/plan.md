## הבעיה

יש שני מקורות להתראות שגויות:

1. **"⚠️ בעיה בקמפיין" (WITH_ISSUES)** — נוצרת גם על קמפיינים שהמשתמש כיבה ידנית. לדוגמה הקמפיינים של ירון ג׳רזינה עם "Pause ads for compromised account" — פייסבוק עצרה אותם, אבל הצוות יודע ולא רוצה שנעיר.

2. **"📉 ירידה חדה בהוצאה"** — מסננת לפי `effective_status === 'ACTIVE'`, אבל זה כולל "Boosted Posts" שהסתיימו (`effective_status` עדיין ACTIVE כי הם נשארים פעילים בזיכרון פייסבוק עד שמוחקים, אבל ה-`configured_status` כבר לא ACTIVE). דוגמאות: פוסטים של מני גרינבאום ואנ. אס. פאנל.

## ההבדל הקריטי

פייסבוק חושפת שני שדות:
- **`configured_status`** = מה שהמשתמש בחר (ACTIVE / PAUSED / DELETED)
- **`effective_status`** = מה שקורה בפועל (יכול להיות WITH_ISSUES / PAUSED / DISAPPROVED אפילו כש-`configured_status=ACTIVE`)

הקוד כבר שולף את `configured_status` (שורה 187) אבל **לא שומר אותו** ב-`CampaignStatus`. כל ההחלטות מתקבלות לפי `effective_status` בלבד — ולכן ההתראות שגויות.

## התיקון

### קובץ: `supabase/functions/cron-sync-facebook-insights/index.ts`

1. **הוספת `configured_status` ל-CampaignStatus** (שורות 31-35 + 191-198).

2. **התראות סטטוס קמפיין** (שורות 533-540): להוסיף תנאי קשיח —
   ```
   if (campaign.configured_status !== 'ACTIVE') continue;
   ```
   כך נתריע רק על קמפיינים שהמשתמש הפעיל ופייסבוק חוסמת.

3. **התראת ירידה בהוצאה** (שורות 612-616): להחליף את הפילטר —
   ```
   .filter((c) => c.configured_status === 'ACTIVE' && c.effective_status === 'ACTIVE')
   ```
   זה מסנן Boosted Posts שכבר הסתיימו.

### ניקוי + הרצה מחדש

4. למחוק את 6+ ההתראות שנוצרו ב-15:10–15:15 (אנומליה ישנה).
5. לפרוס את הפונקציה ולהריץ סנכרון מלא ל-107 חשבונות (14 בצ'ים של 8) — לדווח כמה התראות חדשות נוצרו לפי הלוגיקה החדשה.

## תוצאה צפויה

מתריעים **רק** על:
- חשבון מודעות מנוטרל / ללא אמצעי תשלום (`account_status` בעייתי)
- קמפיין שהמפרסם הפעיל אבל פייסבוק חסמה (`configured_status=ACTIVE` + DISAPPROVED/WITH_ISSUES/PENDING_BILLING_INFO)
- קמפיין פעיל אמיתי (configured+effective = ACTIVE) שצנח בהוצאה השבוע מול קודם

לא מתריעים יותר על: קמפיינים שכובו ידנית, Boosted posts שהסתיימו, ארכיון, שגיאות "compromised account" שעל קמפיינים מושבתים.