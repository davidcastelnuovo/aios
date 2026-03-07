

# תכנית: הוספת "טסט עם ליד קיים" לעורך הפלואו

## מצב נוכחי
- עורך הפלואו (`FlowEditor`) כולל רק `ManualTriggerDialog` — דיאלוג צ'אט לשליחת פקודות טקסט חופשי
- דף האוטומציות הרגיל (`Automations.tsx`) כבר כולל `TestAutomationDialog` עם בחירת ליד/לקוח/משימה, אבל הוא **לא זמין** בעורך הפלואו
- ה-Backend (`trigger-automation`) כבר תומך ב-direct execution עם `automationId` + `data` שכולל `lead_id`, `phone`, `contact_name` וכו'

## פתרון
הוספת כפתור "בדוק עם ליד" בסרגל העליון של `FlowEditor`, שפותח דיאלוג פשוט:

### דיאלוג "בדוק עם ליד"
1. **בחירת ליד** — Combobox עם חיפוש מטבלת הלידים (שם, טלפון, חברה)
2. **תצוגה מקדימה** — הצגת פרטי הליד שנבחר (שם, טלפון, אימייל, סוכנות)
3. **כפתור "הרץ טסט"** — שולח את כל שדות הליד ל-`trigger-automation` ב-direct mode
4. **תוצאה** — הצגת תוצאות כל שלב (✅/❌) כולל output של סוכן AI

### איך זה עובד
```text
בחירת ליד → שליפת כל השדות שלו (כולל custom_fields) →
שליחה ל-trigger-automation עם automationId + data →
הצגת תוצאות שלב-שלב
```

### שינויים

**1. `src/components/automations/FlowEditor.tsx`**
- הוספת כפתור `TestTube` (בדוק עם ליד) בסרגל העליון ליד כפתור ההפעלה הידנית
- Import ושימוש בדיאלוג החדש

**2. `src/components/automations/TestFlowWithLeadDialog.tsx` (חדש)**
- דיאלוג עם:
  - Combobox לבחירת ליד (חיפוש לפי שם/טלפון/חברה)
  - תצוגת פרטי הליד הנבחר
  - כפתור הרצה
  - הצגת תוצאות עם סטטוס כל שלב
- שליחה ל-`trigger-automation` עם `automationId` + כל שדות הליד כ-`data`

### ה-Backend לא צריך שינוי
`trigger-automation` כבר תומך ב:
- `automationId` → direct execution
- `data.lead_id` → שליפת ליד
- `data.contact_name`, `data.phone`, וכו' → variable replacement ב-step_instruction

## קבצים
1. `src/components/automations/TestFlowWithLeadDialog.tsx` — חדש
2. `src/components/automations/FlowEditor.tsx` — הוספת כפתור + import

