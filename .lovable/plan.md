## הבעיה האמיתית

הפונקציה `query-maskyoo-calls` עובדת תקין מבחינת קוד ו-URL. הבעיה היא בצד של מסקיו:

```
The ip address is not legal for this web service 245.231.76.90
```

ה-API של מסקיו עובד עם **IP whitelist** קשיח, וכתובות ה-IP של Supabase Edge Functions לא קבועות ולא נכללות ברשימה. לכן קריאה חיה (live) מה-Edge Function למסקיו תמיד תיכשל — לא קשור ל-base_url, לא לטוקן, ולא לפורמט.

יש שתי דרכים אפשריות לפתור:

### אפשרות א' (מומלצת) — להציג מתוך הסנכרון הקיים
כבר קיימת בפרויקט פונקציה `sync-maskyoo-cdr` שמושכת CDR ושומרת ב-`call_logs` (provider='maskyoo'). אם הסנכרון רץ באופן קבוע (cron / webhook `maskyoo-webhook` בזמן אמת), נחליף את הכרטיס שיקרא מ-`call_logs` במקום מ-API חי. זה גם מהיר וגם לא תלוי ב-whitelist.

הבעיה הקטנה: כרגע ל-tenant הזה אין שום רשומה ב-`call_logs` עם provider='maskyoo'. צריך לוודא שהסנכרון רץ (להפעיל ידנית פעם ראשונה, ולהגדיר cron).

### אפשרות ב' — להוסיף את ה-IP של Supabase ל-whitelist במסקיו
לא ריאלי — IP ה-Edge Functions משתנה.

---

## תוכנית מוצעת

1. **לעדכן `MaskyooCallsCard.tsx`** כך שיקרא ישירות מ-`call_logs` (לא מהפונקציה):
   - `select` מ-`call_logs` עם `provider='maskyoo'`, `tenant_id`, ו-`to_number ilike %last9%` עבור כל מספר.
   - חישוב: incoming = כל הרשומות שתואמות ה-DDI; unique = `distinct from_number`; answered = `status='completed'`.
   - חלון: `created_at >= now() - days`.
2. **למחוק את ה-Edge Function `query-maskyoo-calls`** (לא נחוצה יותר).
3. **לוודא סנכרון יזום אחד** — לקרוא ל-`sync-maskyoo-cdr` פעם אחת ידנית עבור ה-tenant כדי לאכלס היסטוריה (אם זה יעבוד מה-Edge — נראה — אם גם הוא נופל על IP, נצטרך לקרוא לזה מאצלך, מה-WhatsApp/השרת שלך, או להסתמך רק על ה-`maskyoo-webhook` בזמן אמת).
4. **טריגר רענון**: כשהמשתמש מרענן את דוח ה-SEO, הקריאה הקיימת ל-`refetch` של React Query תמשוך מחדש מ-`call_logs` (מהיר, ללא חשש כשלון).

## פרטים טכניים

- שינוי קובץ: `src/components/dynamic-tables/MaskyooCallsCard.tsx` — להחליף את ה-`supabase.functions.invoke("query-maskyoo-calls")` ב-query ישיר ל-`call_logs`.
- מחיקה: `supabase/functions/query-maskyoo-calls/` והערך התואם ב-`supabase/config.toml`.
- אופציונלי: כפתור "סנכרן עכשיו" בכרטיס שיקרא ל-`sync-maskyoo-cdr` (ייתכן שגם זה ייכשל מאותה סיבה — נבדוק לאחר הפעלה).

האם לאשר את התוכנית? (אם כן, אבצע מיד; אם תעדיף שננסה גישה אחרת — תגיד.)