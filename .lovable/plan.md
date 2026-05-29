## אבחון
האוטומציה (`1c7e4bb7...`) שמורה עם:
```
carmen_scope_mode: "specific_group"
carmen_allowed_groups: ["120363425732219862@g.us"]
```
הקבוצה שאתה כותב בה כרגע (`120363406768318497@g.us`) **לא נמצאת ברשימה** → ה-webhook חוסם עם `reason: scope_group`.

המערך אכן תומך בקבוצות מרובות, אבל בפועל נשמרה רק אחת.

## תוכנית

### שלב 1 — תיקון מיידי (DB)
להוסיף את הקבוצה החדשה ל-`carmen_allowed_groups` (מבלי למחוק את הקיימת):
```
carmen_allowed_groups: [
  "120363425732219862@g.us",   // קיים
  "120363406768318497@g.us"    // חדש — הקבוצה שאתה כותב בה
]
```
אחרי זה כרמן תענה מיד בשתי הקבוצות.

### שלב 2 — בדיקת UI של בורר הקבוצות בטריגר Carmen
לבדוק ב-`FlowEditor` / `FlowNode` / רכיב הקונפיג של טריגר `carmen_whatsapp_session` (כנראה משתמש ב-`WhatsAppGroupSelect` במצב multi):
- האם בחירה מרובה אכן מוסיפה ל-`configuration.carmen_allowed_groups` ולא מחליפה?
- האם ה-Save שולח את המערך המלא?
- האם יש Race: טעינה ראשונית מאפסת את הבחירה?

אם נמצא באג, לתקן את ה-handler כך שיעשה append/merge ולא replace, ולוודא ש-save מעביר את המערך כולו.

### שלב 3 — בדיקה חיה
לכתוב "כרמן שומעת" בקבוצה החדשה ולוודא בלוגים של `manus-wa-webhook`:
- אין `blocked by scope_group`
- מופיע `[carmen-group] handled: true`

## פרטים טכניים
- DB: `automations.configuration` (JSONB), שדה `carmen_allowed_groups` (text[]/json array)
- אין צורך ב-redeploy של edge functions לשלב 1
- שלב 2 דורש שינוי קוד פרונט בלבד אם יימצא באג שמירה