

# תכנית: תיקון החלפת משתני פייסבוק באוטומציות

## הבעיה
מהלוגים רואים שהסוכן מקבל את הפלייסהולדרים עצמם (`{{fb_שם_מלא}}`) במקום הערכים האמיתיים. יש שלוש בעיות:

### 1. הרג'קס לא תופס עברית
שורה 315 ב-`trigger-automation`:
```
commandText.replace(/\{\{(\w+)\}\}/g, ...)
```
`\w` תופס רק `[a-zA-Z0-9_]` — לא עברית ולא `?`. צריך לשנות ל-regex שתופס כל תו חוץ מ-`}}`.

### 2. שדות פייסבוק מותאמים לא נשמרים על הליד
הwebhook של פייסבוק (`facebook-lead-webhook`) שולף את כל השדות מהטופס אבל שומר רק `contact_name`, `phone`, `email`. שדות מותאמים כמו "מה שם העסק שלך?" ו"תאר את הנסיון שלך" נזרקים.

### 3. הwebhook של פייסבוק לא מטריגר אוטומציות
אחרי יצירת הליד, הwebhook לא קורא ל-`trigger-automation` עם `lead_created` — כך שהפלואו כלל לא ירוץ אוטומטית על לידים מפייסבוק.

## שינויים

### 1. `supabase/functions/trigger-automation/index.ts`
- **תיקון הרגקס** בשורה 315: שינוי מ-`\w+` ל-`[^}]+` כדי לתפוס כל שם משתנה כולל עברית וסימנים מיוחדים
- החלפה זו חלה על **כל** ה-variable replacement בקובץ (גם בשלבי WhatsApp, webhook וכו')

### 2. `supabase/functions/facebook-lead-webhook/index.ts`
- **שמירת כל שדות הטופס** כ-`facebook_form_data` בעמודת `notes` או ב-JSON על הליד
- **הפעלת אוטומציות**: אחרי יצירת הליד, קריאה ל-`trigger-automation` עם `trigger_type: 'lead_created'` + כל שדות הטופס בתור `fb_` prefixed keys ב-data
- כך הפלואו ירוץ אוטומטית וה-`fb_שם_מלא`, `fb_מספר_טלפון` וכו' יהיו זמינים להחלפה

### 3. `supabase/functions/trigger-automation/index.ts` (agent section)
- גם ב-`lead_data` שמועבר לסוכן, להעביר את כל ה-`fb_` prefixed fields כדי שיהיו בהקשר

## תוצאה צפויה
כשליד חדש נכנס מטופס פייסבוק:
1. הwebhook יוצר את הליד
2. הwebhook קורא ל-`trigger-automation` עם כל השדות (כולל `fb_שם_מלא`, `fb_מה_שם_העסק_שלך?`)
3. הרגקס המתוקן מחליף את `{{fb_שם_מלא}}` → "רוני בוחבוט"
4. הסוכן מקבל את הטקסט עם הערכים האמיתיים

## קבצים לעריכה
1. `supabase/functions/trigger-automation/index.ts` — תיקון regex
2. `supabase/functions/facebook-lead-webhook/index.ts` — שמירת שדות + הפעלת אוטומציה

