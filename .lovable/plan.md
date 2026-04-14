

# תיקון: כרמן מגיבה בשיחות שהיא לא אמורה

## הבעיה שמצאתי

יש **טיפול כפול** בסשנים של כרמן — גם ב-`green-api-webhook` וגם ב-`trigger-automation`. הבאג הקריטי נמצא ב-`trigger-automation`:

כשהודעה נכנסת מאנה (או מכל איש קשר), הזרימה היא:
1. `green-api-webhook` בודק אם יש סשן פעיל של כרמן ל-`chat_id` של אנה → **לא מוצא** → ממשיך
2. `green-api-webhook` בודק אם יש מילת מפתח ("כרמן") → **אין** → ממשיך
3. `green-api-webhook` שולח את ההודעה ל-`trigger-automation`
4. **כאן הבאג:** ב-`trigger-automation` שורה 904-958, אם האוטומציה מסוג `carmen_whatsapp_session`, המערכת **יוצרת סשן חדש לכל הודעה נכנסת** ללא בדיקת מילת מפתח! שורה 933: `if (!payloadData._carmen_session_id)` — אם אין סשן, פותחים חדש אוטומטית.

כלומר — כל הודעה נכנסת מכל צ'אט מפעילה את כרמן, במקום רק הודעות שמכילות את מילת ההפעלה.

## התיקון

### קובץ: `supabase/functions/trigger-automation/index.ts`

**שורות 893-967** — להוסיף בדיקת מילת מפתח לפני יצירת סשן חדש:

בבלוק שמתחיל בשורה 933 (`if (!payloadData._carmen_session_id)`), צריך להוסיף תנאי: **אל תיצור סשן חדש אלא אם ההודעה מכילה את מילת ההפעלה (trigger keyword)**. אם אין מילת מפתח בהודעה ואין סשן פעיל — לדלג על שלב ה-agent לחלוטין.

```text
Flow לפני התיקון:
  isCarmenFlow? → yes
    has session? → no → CREATE NEW SESSION (bug!)

Flow אחרי התיקון:
  isCarmenFlow? → yes
    has session? → no
      has trigger keyword? → no → SKIP (don't create session)
      has trigger keyword? → yes → CREATE NEW SESSION ✓
```

בנוסף, צריך לוודא שה-`hasActiveCarmenSession` flag בשורות 440-536 **לא מאפשר** לאוטומציה Carmen לרוץ על צ'אטים שלא הופעלו עם מילת מפתח.

### Deploy
- Deploy מחדש את `trigger-automation`

