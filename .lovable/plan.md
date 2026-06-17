## הבעיה

אוטומציית "כרמן / ישיר" מוצמדת ל-`carmen_integration_id` של Manus. כשמספר מותר (למשל 972507677613) שולח "כרמן" דרך WhatsApp שלו (Green API) למספר של Carmen ב-Manus:

- `green-api-webhook` קולט את ההודעה ומריץ `findCarmenSessionAutomation` עם ה-integrationId של Green API.
- הפונקציה מסננת אוטומציות שמוצמדות לאינטגרציה אחרת (Manus) ומחזירה null.
- לכן Carmen לא מופעלת — למרות שהמספר מופיע ב-`carmen_allowed_phones`.

## הפתרון

לאפשר Override של ה-Pin על האינטגרציה כשהשולח נמצא ברשימת המספרים המותרים של אוטומציה במצב `specific_phone`.

## שינוי קוד

**קובץ:** `supabase/functions/_shared/carmen.ts` — פונקציה `findCarmenSessionAutomation`.

שינוי הלוגיקה של דירוג האוטומציות (סביב שורה 213-224):

- כיום: אוטומציה מוצמדת לאינטגרציה זרה — נזרקת לחלוטין.
- אחרי: אוטומציה מוצמדת לאינטגרציה זרה תיכלל גם כן, אם:
  - `carmen_scope_mode === 'specific_phone'`
  - וההודעה היא 1:1 (לא קבוצה)
  - וה-`phoneNumber` הנכנס מופיע ב-`carmen_allowed_phones` (השוואת ספרות אחרונות, כמו ההשוואה הקיימת ב-`scoreStep`).

במקרה כזה האוטומציה תקבל ניקוד גבוה (100) ב-`scoreStep` ותענה. התשובה תישלח דרך ה-`sendMessage` של הערוץ שקיבל את ההודעה (Green API במקרה הזה) — כלומר התשובה חוזרת לאותו מספר ששלח.

## מה לא משתנה

- קבוצות (`specific_group`) — נשאר כפי שהוא, ההצמדה ל-Manus עדיין הכרחית.
- אוטומציה ללא Pin (`carmen_integration_id` ריק) — ממשיכה לעבוד בכל הערוצים.
- ה-Echo Guard ב-`manus-wa-webhook` (שמונע תגובה כפולה כשמשתמש שולח דרך Green וגם Manus משקף את ההודעה) נשאר.

## בדיקה

לאחר הפריסה: שליחה של "כרמן" מ-972507677613 דרך ה-WhatsApp שלו → green-api-webhook יזהה את האוטומציה למרות ה-Pin → Carmen תענה דרך Green API.
