
# תוכנית: תיקון אינטגרציית ManyChat ללידים חדשים

## הבעיה שזוהתה

מהלוגים של הפונקציה `auto-sync-new-lead` זיהיתי את הבעיות הבאות:

1. **ManyChat מחזיר "This WhatsApp ID already exists"** - הנרשם כבר קיים במערכת ManyChat
2. **חיפוש לפי `wa_id` נכשל** - ManyChat API לא תומך בחיפוש לפי `wa_id` או `whatsapp_phone` דרך `findBySystemField`
3. **המערכת לא מצליחה לאחזר את ה-subscriber_id** של נרשמים קיימים שנוצרו רק עם `whatsapp_phone`

### מגבלת ManyChat API
לפי התיעוד והפורום של ManyChat, ה-API תומך בחיפוש רק לפי:
- `phone` (שדה מערכת סטנדרטי)
- `email` (שדה מערכת סטנדרטי)

נרשמים שנוצרו רק עם `whatsapp_phone` **לא ניתנים לחיפוש** דרך ה-API הסטנדרטי.

---

## הפתרון המוצע

### גישה: Custom Field + findByCustomField

1. **יצירת Custom Field ב-ManyChat** בשם `phone_number` (או שימוש בקיים)
2. **שמירת מספר הטלפון** בשדה המותאם בעת יצירת נרשם
3. **חיפוש לפי `findByCustomField`** במקום `findBySystemField` עבור wa_id

### שינויים נדרשים

#### 1. עדכון `auto-sync-new-lead/index.ts`

```text
הלוגיקה החדשה:
1. חפש לפי phone (כמו היום)
2. חפש לפי email (כמו היום)  
3. חפש לפי Custom Field "phone_number" (חדש!)
4. אם לא נמצא - נסה ליצור
5. אם יצירה נכשלת עם "WhatsApp ID already exists":
   - נסה שוב חיפוש עם כל הפורמטים
   - אם עדיין לא נמצא - סמן כ-NEEDS_MANUAL_LINK
6. בעת יצירה - הוסף גם לשדה Custom Field
```

#### 2. הוספת פונקציה `findByCustomField`

```javascript
async function findSubscriberByCustomField(
  apiKey: string, 
  fieldId: number, 
  phoneValue: string
): Promise<string | null> {
  const url = `https://api.manychat.com/fb/subscriber/findByCustomField?field_id=${fieldId}&field_value=${encodeURIComponent(phoneValue)}`;
  const res = await fetch(url, {
    headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  if (data?.status === 'success' && data?.data?.id) {
    return String(data.data.id);
  }
  return null;
}
```

#### 3. עדכון יצירת subscriber

בעת יצירת נרשם חדש, נוסיף את מספר הטלפון גם ל-Custom Field:

```javascript
// After creating subscriber, set custom field
await fetch('https://api.manychat.com/fb/subscriber/setCustomFieldByName', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    subscriber_id: subscriberId,
    field_name: 'phone_number',
    field_value: formattedPhone
  })
});
```

---

## דרישות מוקדמות

### ב-ManyChat (פעולה ידנית חד-פעמית)
1. צור Custom Field בשם `phone_number` מסוג Text
2. (אופציונלי) הרץ אוטומציה שתעתיק `whatsapp_phone` ל-`phone_number` עבור כל הנרשמים הקיימים

---

## סיכום השינויים

| קובץ | שינוי |
|------|-------|
| `supabase/functions/auto-sync-new-lead/index.ts` | הוספת חיפוש לפי Custom Field, שמירה בשדה מותאם |
| `supabase/functions/trigger-automation/index.ts` | עדכון תואם |

---

## תוצאה צפויה

לאחר השינויים:
- לידים חדשים ייווצרו ב-ManyChat עם שדה מותאם לחיפוש
- לידים קיימים (שנוצרו רק עם whatsapp_phone) יסומנו כ-`NEEDS_MANUAL_LINK` במקום `SYNC_CONFLICT`
- חיפוש יעבוד גם עבור נרשמים שיש להם Custom Field מעודכן
