

# תיקון שגיאת CORS ב-Edge Functions של Unified.to

## הבעיה
ה-Edge Functions `unified-connections` ו-`unified-api-proxy` קורסות בזמן טעינה כי הן מנסות לייבא `corsHeaders` מנתיב שלא קיים בגרסה 2.75.0 של supabase-js:

```
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.75.0/cors";
```

הייצוא הזה נוסף רק בגרסה 2.95.0+. הפונקציות נופלות לפני שהן מגיעות לשורת קוד אחת — לכן אין לוגים בכלל.

הפונקציה `unified-calendar-proxy` **עובדת תקין** כי היא מגדירה את ה-CORS headers ידנית.

## התיקון

### שינוי 1: `supabase/functions/unified-connections/index.ts`
- הסרת הייבוא השגוי של `corsHeaders`
- הגדרת CORS headers ידנית (כמו ב-`unified-calendar-proxy`)

### שינוי 2: `supabase/functions/unified-api-proxy/index.ts`
- אותו תיקון — הגדרת CORS headers ידנית

### פרטים טכניים
בשתי הפונקציות, שורה 2 תשתנה מ:
```ts
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.75.0/cors";
```
ל:
```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

אין שינויים נוספים נדרשים — כל שאר הקוד כבר משתמש ב-`corsHeaders` נכון.

