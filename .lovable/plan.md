

# תוכנית: הפרדת חיבור Green API בפלאו מהחיבור הראשי

## בעיה שנמצאה
יש באג קריטי: הפרונטאנד שומר את החיבור שנבחר בשם `green_api_integration_id`, אבל הבקאנד קורא את השדה `integration_id`. כתוצאה מכך, הבחירה הספציפית של חיבור **נתעלמת** והמערכת נופלת ל-fallback — החיבור הפעיל הראשון של הטננט, שזה בדרך כלל החיבור הראשי.

## פתרון

### קובץ: `supabase/functions/trigger-automation/index.ts`
בשורה ~1889, לעדכן את ה-destructuring כך שיתמוך בשני שמות השדות:

```typescript
const { message_template, send_to_type, ... } = config
const integration_id = config.integration_id || config.green_api_integration_id
```

זה שינוי של שורה אחת בלבד שמבטיח שכשמשתמש בוחר חיבור ספציפי בפלאו, הוא באמת ישמש — במקום ליפול ל-fallback של החיבור הראשי.

### קבצים לעריכה:
- `supabase/functions/trigger-automation/index.ts` — תיקון מיפוי שם השדה

