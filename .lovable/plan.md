

# תוכנית: הוספת אפשרות טלפון ידני + חיבור חיצוני לפעולת WhatsApp

## סקירה
כרגע בפעולת WhatsApp (Green API) אפשר רק לבחור שדה דינמי לטלפון מתוך הטריגר, וחיבור Green API מוגבל לארגון הנוכחי בלבד. צריך להוסיף:
1. אפשרות להזין מספר טלפון ידנית (בנוסף לבחירת שדה)
2. אפשרות לחבר אינטגרציית Green API שלא שייכת לארגון הנוכחי

## שינויים

### 1. `StepConfigPanel.tsx` - GreenAPIActionConfig
**שדה טלפון:**
- הוספת בחירה בין "שדה דינמי" ל"מספר ידני" (radio/select toggle)
- כש"מספר ידני" נבחר, מציג Input לכתיבת מספר טלפון ישירות
- שמירה ב-configuration כ-`phone_mode: "field" | "manual"` ו-`manual_phone: "0501234567"`

**חיבור Green API:**
- הוספת אפשרות "חיבור חיצוני" בסלקטור החיבורים
- כש"חיצוני" נבחר, מציג שדות להזנת `instance_id` ו-`api_token` ידנית
- שמירה ב-configuration כ-`green_api_mode: "tenant" | "external"` עם `external_instance_id` ו-`external_api_token`

### 2. `trigger-automation` Edge Function
- עדכון הלוגיקה של פעולת `send_greenapi_message`:
  - אם `phone_mode === "manual"` - שימוש ב-`manual_phone` במקום שליפה מהשדה
  - אם `green_api_mode === "external"` - שימוש ב-`external_instance_id` ו-`external_api_token` במקום שליפה מ-`tenant_integrations`

## קבצים
1. **עדכון**: `src/components/automations/StepConfigPanel.tsx` - UI לטלפון ידני + חיבור חיצוני
2. **עדכון**: `supabase/functions/trigger-automation/index.ts` - לוגיקת שליחה עם הפרמטרים החדשים

