
## מטרה

לאפשר **מספר חיבורי Manus WhatsApp לכל משתמש בארגון**, כל אחד עם **שם תצוגה** משלו. כיום יש חיבור יחיד בלבד (`maybeSingle` על `tenant_id+user_id+integration_type='manus_wa'`). החיבור הקיים יקבל את השם **"Carmen"**.

מבחינת בק-אנד: `manus-wa-webhook` כבר מוצא את החיבור הנכון לפי `instance_id`, אז הוא יעבוד עם מספר חיבורים ברגע שמשחררים את המגבלה של רשומה יחידה.

## שינויים

### 1) מיגרציית DB
- הוספת עמודה `display_name TEXT` ל-`tenant_integrations`.
- Backfill: לכל רשומת `manus_wa` קיימת – אם `display_name` ריק, להגדיר "Carmen".

### 2) דף `ManusWhatsAppSettings.tsx` – שיפוץ למודל רב-חיבורים
- שאילתה: רשימת כל ה-`manus_wa` של המשתמש (`order by created_at`), במקום `maybeSingle`.
- UI:
  - רשימת חיבורים (כרטיסים) עם שם, סטטוס, מספר טלפון, וכפתורי "ערוך / מחק / בדוק סטטוס / סנכרן סוד".
  - כפתור "הוסף חיבור חדש" שפותח דיאלוג עם השדות הקיימים (Instance ID, API Key, קידומת, **שם חיבור**) + Webhook URL/Secret.
  - בעריכה: אותו דיאלוג עם הערכים הקיימים, כולל עריכת שם.
- שמירה: insert/update כולל `display_name`.

### 3) טיפול ב"חיבור ברירת מחדל" כשלא מועבר `integrationId`
כדי לא לשבור קוד קיים שמסתמך על חיבור יחיד:
- `supabase/functions/send-manus-wa-message/index.ts` ו-`send-manus-wa-file/index.ts`: להחליף את ה-`maybeSingle` ב-`order by created_at asc + limit 1` (הראשון = הוותיק = "Carmen") כשלא מגיע `integrationId`. זה משמר התנהגות נוכחית של ה-CRM/לידים שלא בוחרים חיבור.
- `ChatView.tsx`: היום בוחר ספק (`manus_wa`) אבל לא חיבור ספציפי. נשאיר כפי שהוא ונשלח בלי `integrationId` → ייפול לברירת המחדל הוותיקה. (שיפור מלא של בורר-חיבור בצ׳אט = שלב עתידי, מחוץ ל-scope עכשיו.)

### 4) `StepConfigPanel.tsx` (אוטומציות)
- הקוד כבר תומך בבחירת חיבור ספציפי (`integration_id`) לאוטומציות. רק להוסיף הצגת `display_name` ליד שם הספק בדרופ-דאון הבחירה (כשקיים), כדי שיהיה אפשר להבדיל בין "Carmen" לחיבור עתידי.

### 5) Carmen automation (היקף)
`carmen_integration_id` ב-`automations.configuration` כבר קיים. כך, אוטומציית כרמן תרוץ רק על החיבור שאליו היא מצומדת — מה שמשיג את היעד של "אוטומציות שונות על חיבורי Manus שונים". לא נדרש שינוי קוד נוסף ב-`_shared/carmen.ts`.

## בלי שינויים
- אין שינוי בלוגיקה של הוובהוק (כבר מזהה לפי instance_id).
- אין שינוי במבנה ה-RLS (פוליסיות הקיימות תקפות גם למספר רשומות).

## אימות
1. הרשומה הקיימת תופיע ברשימה עם השם "Carmen".
2. הוספת חיבור Manus שני עם Instance/