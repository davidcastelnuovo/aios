
# תוכנית: תיקון אינטגרציית ManyChat - שימוש נכון ב-field_id

## סיכום הבעיות שזוהו בלוגים

| בעיה | סיבה |
|------|------|
| `field_id cannot be blank` | הקוד שולח `field_name` במקום `field_id` המספרי |
| `Api max rps reached` | יותר מדי קריאות מקבילות |
| `WhatsApp ID already exists` | Subscriber קיים אך לא ניתן למצוא (נוצר רק עם whatsapp_phone) |

## הפתרון

### שלב 1: פונקציה חדשה לשליפת field_id

נוסיף פונקציה שקוראת ל-`/fb/page/getCustomFields` ומוצאת את ה-ID של שדה `phone_number`:

```text
async function getCustomFieldId(apiKey, fieldName):
  1. קריאה ל-/fb/page/getCustomFields
  2. חיפוש השדה לפי name
  3. החזרת field_id או null
```

### שלב 2: עדכון findByCustomField

במקום לשלוח `field_name`:
```javascript
// נכשל:
/fb/subscriber/findByCustomField?field_name=phone_number&field_value=...

// נכון:
/fb/subscriber/findByCustomField?field_id=12345678&field_value=...
```

### שלב 3: הפחתת קריאות מקבילות

1. לא לחפש את כל הפורמטים במקביל - לעשות סדרתית
2. להוסיף caching ל-field_id (מספיק לשלוף פעם אחת לכל tenant)

### שלב 4: שמירת field_id בהגדרות

נשמור את ה-`phone_number_field_id` בטבלת `tenant_integrations.settings` כדי לחסוך קריאות חוזרות ל-API.

---

## קבצים לעדכון

| קובץ | שינוי |
|------|-------|
| `supabase/functions/auto-sync-new-lead/index.ts` | פונקציה לשליפת field_id, שימוש ב-field_id במקום field_name |
| `supabase/functions/trigger-automation/index.ts` | אותם שינויים |

---

## לוגיקה חדשה

```text
1. שלוף את phone_number_field_id מ-settings (אם קיים)
2. אם לא קיים - קרא ל-getCustomFields ושמור ב-settings
3. חפש לפי phone (שדה מערכת)
4. חפש לפי email (שדה מערכת)
5. חפש לפי custom field עם field_id
6. אם לא נמצא - צור subscriber חדש
7. אחרי יצירה - עדכן את phone_number custom field
```

---

## תוצאה צפויה

- לידים חדשים יירשמו ב-ManyChat בהצלחה
- ה-subscriber_id יתעדכן בטבלת leads
- לא יהיו שגיאות Rate Limit (קריאות סדרתיות)
- לידים שכבר קיימים ב-ManyChat יזוהו דרך ה-Custom Field
