

# תוכנית: מיפוי שדות + בחירת חיבור Green API בפעולת WhatsApp

## סקירה
כשמשתמש בוחר פעולת "שלח WhatsApp (Green API)" בפלוו, צריך להציג:
1. **בחירת חיבור Green API** - מתוך `tenant_integrations` (integration_type = 'green_api')
2. **מיפוי שדה מספר טלפון** - בחירת שדה הטלפון מתוך השדות הזמינים מהשלב הקודם (טריגר)
3. **תבנית הודעה** - עם אפשרות להכניס משתנים מהשדות הזמינים

## שדות זמינים לפי סוג טריגר
מיפוי סטטי של שדות לפי סוג הטריגר:

| טריגר | שדות |
|--------|-------|
| lead_created | contact_name, company_name, phone, email, source, notes |
| lead_status_changed | contact_name, company_name, phone, email, old_status, new_status |
| client_created | name, contact_name, phone, email |
| task_assigned | title, assignee_name |
| meeting_created | title, date |

## שינויים ב-StepConfigPanel.tsx

### 1. הוספת לוגיקת שדות זמינים
פונקציה `getAvailableFields(triggerType)` שמחזירה רשימת שדות עם label ו-key לפי סוג הטריגר של הפלוו.

### 2. הרחבת קונפיגורציית Green API action
כש-`action_type === "send_greenapi_message"`:
- **Select חיבור Green API** - שאילתה ל-`tenant_integrations` עם `integration_type = 'green_api'`
- **Select שדה טלפון** - dropdown עם השדות הזמינים מהטריגר (למשל `{{phone}}`, `{{email}}`)
- **תבנית הודעה** - Textarea קיים + רשימת משתנים דינמית מהשדות הזמינים

### 3. שמירה ב-configuration
```json
{
  "green_api_integration_id": "uuid",
  "phone_field": "phone",
  "message_template": "שלום {{contact_name}}, ..."
}
```

### 4. זיהוי הטריגר
הקומפוננטה צריכה לקבל את רשימת כל הנודים בפלוו כדי למצוא את נוד הטריגר ולדעת אילו שדות זמינים. נעביר את ה-`nodes` כ-prop ל-`StepConfigPanel`.

## קבצים לעדכון
- `src/components/automations/StepConfigPanel.tsx` - הוספת בחירת חיבור, מיפוי שדות, משתנים דינמיים
- `src/components/automations/FlowEditor.tsx` - העברת nodes כ-prop ל-StepConfigPanel

