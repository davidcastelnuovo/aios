

# תיקון: הזנה ידנית לא מושכת פרטי ליד ולא שולחת לקבוצה

## שני באגים שנמצאו

### באג 1: שליחה לקבוצה נשברת
בפונקציה `executeGreenApiMessage`, כש-`phone_mode === "manual"` והערך הוא Group ID (`120363241239999109@g.us`), הקוד מפשיט את כל התווים שאינם ספרות ומוסיף `@c.us` — וזה הורס את מזהה הקבוצה. צריך לזהות אם `manual_phone` מכיל `@g.us` ולטפל בו כקבוצה.

### באג 2: שדות FB בשמות אנגליים במקום עברית
ההזנה הידנית שולחת `fb_phone`, `fb_full_name` וכו', אבל בפועל הלידים מפייסבוק מגיעים עם שמות שדות מהטופס בעברית: `fb_שם_מלא`, `fb_מספר_טלפון`, `fb_email`. הפלו משתמש ב-`{{fb_שם_מלא}}` ולכן ההזנה הידנית לא מתאימה.

## שינויים

### 1. Backend: `supabase/functions/trigger-automation/index.ts`
בפונקציה `executeGreenApiMessage`, בתנאי `phone_mode === "manual"` (שורה ~1908-1913):
- לבדוק אם `manual_phone` מכיל `@g.us` — אם כן, להשתמש בו כ-chatId ישירות (כקבוצה)
- רק אם לא, לטפל בו כמספר טלפון

### 2. Frontend: `src/components/automations/TestFlowWithLeadDialog.tsx`
בקטע ההזנה הידנית (שורה ~287-304):
- לקרוא את `facebook_form_fields` מה-`triggerStep.configuration`
- למפות את השדות הידניים (phone, contact_name, email) לשמות השדות **האמיתיים** מהטופס לפי ה-type שלהם (PHONE → `fb_מספר_טלפון`, FULL_NAME → `fb_שם_מלא`, EMAIL → `fb_email`, CUSTOM → `fb_{label}`)
- כך המשתנים `{{fb_שם_מלא}}` ו-`{{fb_מספר_טלפון}}` יזוהו נכון בשלב ה-agent

### קבצים לעריכה:
1. `supabase/functions/trigger-automation/index.ts` — תיקון זיהוי קבוצה ב-manual phone mode
2. `src/components/automations/TestFlowWithLeadDialog.tsx` — מיפוי שדות FB לפי שמות הטופס האמיתיים

