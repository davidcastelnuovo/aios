

# הוספת תמיכה ב-`{{message_text}}` בהחלפת משתנים באוטומציות

## הבעיה
הפונקציה `replaceTemplateVariables` ב-`trigger-automation` לא כוללת את `message_text` במפת המשתנים. הנתון מגיע בפיילואד (מ-Green API webhook ומ-ManyChat) אבל לא מוחלף בטמפלייט.

## הפתרון
הוספת `message_text` (וגם `sender_name`, `sender_phone`, `group_name` שגם מגיעים בפיילואד) למפת המשתנים בפונקציה `replaceTemplateVariables`.

### שינוי ב-`supabase/functions/trigger-automation/index.ts`:

בשורה ~1807 (סוף מפת ה-variables), הוספת:
```typescript
// Chat/message variables
message_text: data.message_text || '',
sender_name: data.sender_name || '',
sender_phone: data.sender_phone || '',
group_name: data.group_name || '',
```

שינוי בקובץ אחד בלבד, תיקון של 4 שורות.

