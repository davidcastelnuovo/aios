

# תכנית: משיכת פרמטרים מטופס לידים לשימוש בשלבים הבאים

## בעיה
כשבוחרים טריגר "ליד מטופס ליד (Facebook)" ובוחרים טופס, השדות של הטופס לא נשמרים ולא זמינים כמשתנים דינמיים בשלבים הבאים (שליחת הודעה, יצירת משימה וכו').

## פתרון

### שינוי 1: שמירת שדות הטופס בקונפיגורציה
**קובץ: `src/components/automations/StepConfigPanel.tsx`**
- עדכון `FacebookForm` interface להכיל `fields: { key, label, type }[]`
- בעת שמירת בחירת הטופס (`onSave`), לשמור גם את `facebook_form_fields` ב-configuration
- העברת השדות מ-`formsData` → `selectedForm.fields` → `configuration.facebook_form_fields`

### שינוי 2: חשיפת שדות הטופס כמשתנים דינמיים
**קובץ: `src/components/automations/StepConfigPanel.tsx`**
- עדכון `getAvailableFields()`: כשה-trigger הוא `lead_created` עם `lead_source === "facebook_form"`, להוסיף את השדות מ-`configuration.facebook_form_fields` לרשימת המשתנים הזמינים
- השדות יופיעו עם prefix `fb_` (למשל `{{fb_full_name}}`, `{{fb_email}}`) כדי להבדיל אותם משדות ברירת מחדל
- יופיעו גם ככפתורי "הכנס משתנה" בתבנית ההודעה

### שינוי 3: העברת נתוני הטריגר ל-`getAvailableFields`
- הפונקציה `getAvailableFields` תקבל פרמטר נוסף: `triggerConfig` (הקונפיגורציה של ה-trigger node)
- כשהטריגר הוא `lead_created` + `facebook_form`, תוסיף את שדות הטופס מ-`triggerConfig.facebook_form_fields`

## קבצים לעריכה
1. `src/components/automations/StepConfigPanel.tsx` — כל השינויים

## פרטים טכניים
ה-edge function `get-facebook-forms` כבר מחזיר `fields` (מ-`form.questions`) עם `key`, `label`, `type`. צריך רק לשמור אותם ולהנגיש אותם ב-UI.

