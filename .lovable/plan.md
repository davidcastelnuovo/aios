## הבעיה

מסקיו **כן שולחים** את הוובהוק (4 קריאות נראו ב-edge logs), אבל:

1. **הם שולחים GET ולא POST** — והפונקציה הקיימת תומכת בשניהם, אז זו לא הבעיה האמיתית.
2. **ה-tenant_id מקולקל ב-URL**: הם מצרפים `?event=hangup` בסוף ה-URL שלנו, אבל ה-URL שלנו כבר מסתיים ב-`?tenant_id=...`. התוצאה: `tenant_id=2dcdaac6-...?event=hangup` (כלומר ה-`?` השני מתפרש כחלק מערך ה-tenant_id).
3. **הקריאות מחזירות 404** — כי ה-`tenant_id` המקולקל לא נמצא ב-DB.

## מה לתקן ב-`supabase/functions/maskyoo-webhook/index.ts`

1. **תיקון ה-tenant_id המקולקל**: אם `params.tenant_id` מכיל `?`, לפצל אותו ולהוציא את ה-UUID האמיתי + להוסיף את שאר הפרמטרים (`event=hangup` וכו').
2. **תמיכה ב-Maskyoo Template fields**: למפות את השמות שמסקיו שולחים בפועל:
   - `cli` / `cli_unformatted` → caller (from)
   - `destination` / `maskyoo` → called (to)
   - `uuid` → unique id
   - `status=ANSWER/NO ANSWER/BUSY` → status
   - `duration` → duration
   - `recording` → recording URL (לשמור ב-notes)
3. **לוודא שהפונקציה נפרסת מחדש** (היא כבר deployed עם `verify_jwt = false`).

## מה אתה צריך לעשות אצל מסקיו

זה ייתקן את הבאג גם אם תשאיר את ה-URL כמו שהוא, אבל **עדיף** שתשנה אצלם את ה-URL כך שלא יוסיפו `?event=hangup`. אם הם דורשים את הפרמטר הזה, תגיד להם להחליף ב-URL את ה-`?` הראשון ל-`&`. כלומר תן להם את ה-URL הזה בלבד:

```
https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/maskyoo-webhook?tenant_id=2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019
```

## אחרי הפריסה

נריץ שיחת טסט נוספת ונבדוק שהיא נכנסת ל-`call_logs` עם status 200.
