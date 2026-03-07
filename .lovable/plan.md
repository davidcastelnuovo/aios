

# תיקון שגיאת חיבור Gmail - CORS Headers

## הבעיה
הפונקציה `gmail-auth` פרוסה ועובדת (curl מחזיר 200), אבל הדפדפן מקבל "Failed to fetch" כי ה-CORS headers חסרים headers שה-Supabase JS client שולח. ה-preflight (OPTIONS) request נכשל.

## הפתרון
עדכון ה-`corsHeaders` בשתי הפונקציות (`gmail-auth` ו-`gmail-api`) להוספת כל ה-headers הנדרשים:

```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

## קבצים לעריכה
1. `supabase/functions/gmail-auth/index.ts` - עדכון corsHeaders (שורה 7)
2. `supabase/functions/gmail-api/index.ts` - עדכון corsHeaders (שורה 7)

