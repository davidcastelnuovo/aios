# החיבור ל-Google Search Console של רינת מתנות מרגשות

## הבעיה

החיבור ל-GSC של הטננט (marketingcaptain) **קיים** במסד הנתונים — שתי אינטגרציות עם 45–51 נכסים שמורים. אבל בלוגים של ה-edge function `google-search-console-auth` יש שגיאה חוזרת:

> `Error fetching sites: Request had invalid authentication credentials...`

כלומר ה-access token של גוגל פג, ה-refresh נכשל בשקט, ולכן הקריאה החיה ל-`get_sites` מחזירה 0 נכסים. בגלל זה:

- כרטיס ה-GSC כן מציג "מחובר" (יש שורה ב-DB).
- אבל הדרופדאון "בחר נכס" לא מופיע, כי הוא נשען רק על התוצאה החיה (`usableSites`), לא על מה ששמור.
- והודעת השגיאה הגנרית "החיבור קיים אבל לא נטענו נכסים" לא מסבירה שצריך להתחבר מחדש.

## הפתרון

### 1. Edge function `google-search-console-auth` (action=`get_sites`)
- כש-Google מחזיר 401 / `invalid_grant` / `invalid authentication credentials` — לנסות **תמיד** לרענן עם ה-refresh_token (לא רק כשהתפוגה חלפה לפי ה-DB), ואז לחזור לבקשה.
- אם גם הריענון נכשל (refresh_token נמחק/בוטל בצד גוגל) — להחזיר תשובה מובנית:
  ```json
  { "sites": [], "needs_reconnect": true, "owner_email": "...", "reason": "token_revoked" }
  ```
  במקום לזרוק 500.

### 2. Frontend `GscIntegration.tsx`
- אם הקריאה ל-`get_sites` נכשלה אבל יש `settings.available_sites` שמורים — להשתמש בהם כ-fallback כדי שהדרופדאון יופיע ויאפשר לבחור נכס למרות שהריענון נכשל.
- כש-`needs_reconnect=true` (או הקריאה זרקה שגיאה) — להציג באנר עם:
  - הסבר "החיבור ל-Google של *פלוני* פג תוקף — יש להתחבר מחדש"
  - כפתור "חבר מחדש" שיפעיל את אותו זרימת OAuth שכפתור "חיבור ראשוני" משתמש בה.
- להסיר את ההודעה הגנרית הנוכחית "החיבור קיים אבל לא נטענו נכסים" כשמדובר במצב reconnect — להחליף בהודעה הברורה.

### 3. השפעה על רינת מתנות מרגשות
לאחר השינוי:
- הדרופדאון יופיע מיד מתוך הרשימה השמורה (45–51 נכסים), כך שאפשר לבחור את הנכס של `rinatmatanot.co.il`.
- במקביל יופיע באנר "החיבור פג תוקף — חבר מחדש" שיאפשר חידוש OAuth ב-Google של בעל החיבור.

## קבצים שיתעדכנו

- `supabase/functions/google-search-console-auth/index.ts` — טיפול ב-401/refresh-fallback + תשובה `needs_reconnect`.
- `src/components/dynamic-tables/seo/GscIntegration.tsx` — fallback ל-`available_sites` השמורים, באנר reconnect, כפתור חיבור מחדש.

ללא שינויי DB, ללא שינוי ב-RLS, ללא שינוי ב-`fetch-gsc-data`.
