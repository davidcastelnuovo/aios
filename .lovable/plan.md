

## שיתוף חיבור טלגרם בין ארגונים (כמו פייסבוק)

### האבחנה
האוטומציה "התראה לטלגרם" יושבת בארגון **Yuval-Uzana**, אבל לארגון הזה אין רשומת בוט פעילה ב-`telegram_bot_state`. רק שני ארגונים מוגדרים כיום עם בוט פעיל:
- **MarketingCaptain** (Carmen / @Afterleafbot)
- **DMM** (Carmen / @Afterleafbot)

ה-Bot Token עצמו הוא **גלובלי** במערכת (env var `TELEGRAM_API_KEY` ב-Lovable Cloud), אבל הקוד הקיים (`TelegramSettings`, `telegram-send`, וה-poller) עובד מול `telegram_bot_state` per-tenant בלבד. כדי שאוטומציה בארגון של יובל תוכל להישען על אותו בוט בלי שיובל יצטרך ליצור בוט חדש דרך BotFather, נוסיף מנגנון שיתוף זהה בעיקרון לזה של פייסבוק.

### העיקרון
מוסיפים עמודה `shared_from_state_id` ל-`telegram_bot_state` (כמו `shared_from_integration_id` ב-`tenant_integrations`). ארגון יכול להיווצר עם רשומה "צל" שמצביעה על בוט פעיל בארגון אחר, ובכל מקום בקוד שצריך לוודא בוט פעיל — בודקים גם את הצל וגם את המקור.

### שינויים בבסיס הנתונים (migration)
1. הוספת `shared_from_state_id uuid REFERENCES telegram_bot_state(id) ON DELETE CASCADE` לטבלת `telegram_bot_state`.
2. הסרת הייחודיות הקיימת על `tenant_id` אם קיימת unique constraint שמונעת רשומה כפולה (יישאר UNIQUE רק לרשומות "אמיתיות"; לרשומות שיתוף יותר חופשי).
3. הוספת RLS חדש: בעלים של ארגון המקור יכול ליצור/למחוק רשומות שיתוף לארגונים שהוא חבר בהם.

### שינויים בקוד

**1. רכיב חדש `ShareTelegramConnectionSection.tsx`** (מחקה את `ShareFacebookConnectionSection`):
- מציג רשימת ארגונים אחרים שהמשתמש חבר בהם.
- צ'קבוקסים לבחירה + כפתור "שמור שיתופים".
- ה-mutation מבצע insert/delete של רשומות צל ב-`telegram_bot_state` עם `shared_from_state_id` מצביע לבוט המקורי.

**2. עדכון `src/pages/TelegramSettings.tsx`**:
- הצגת באנר "בוט משותף מארגון X" כשהבוט הנוכחי הוא צל (`shared_from_state_id` קיים) — כולל כפתור "הסר שיתוף".
- הצגת `ShareTelegramConnectionSection` רק כשמדובר בבוט מקורי (לא משותף).
- הסתרת טופס "Bot Token" כשהבוט הוא משותף.

**3. עדכון `supabase/functions/trigger-automation/index.ts`** (שלב `send_telegram` בשורה ~1154):
- אין צורך לשנות את לוגיקת השליחה (היא משתמשת ב-`TELEGRAM_API_KEY` הגלובלי), אבל **כן צריך** להוסיף בדיקת קיום בוט פעיל ל-tenant (כדי לתת שגיאה ברורה אם אין שיתוף).
- הבדיקה: יש ל-tenant רשומה ב-`telegram_bot_state` עם `is_active=true` — אם זו רשומת צל, נטען גם את ה-`bot_username` מהמקור לתיעוד ההודעה היוצאת.

**4. עדכון `supabase/functions/telegram-send/index.ts`**:
- אם `botState` של ה-tenant הוא צל, בכל זאת מאשר שליחה (הבוט הגלובלי תקף).

**5. עדכון `supabase/functions/telegram-poll/index.ts`**:
- כשמדלגים על רשומות צל בלולאת ה-poll (אין צורך לבצע long-polling פעמיים על אותו בוט). הצל ירש offset מהמקור — נסנן `shared_from_state_id IS NULL` בשליפת הבוטים.
- ההודעות הנכנסות יישארו ב-tenant של המקור (`MarketingCaptain`); זה תקין כי `chat_id` של יובל (6267185334) מקושר אישית, לא ל-tenant.

### תהליך השימוש מצד המשתמש
1. נכנסים ל-`TelegramSettings` בארגון **MarketingCaptain** (שם הבוט המקורי).
2. בכרטיס "שתף חיבור עם ארגונים אחרים" מסמנים את **Yuval-Uzana**.
3. לוחצים שמור — נוצרת רשומת צל פעילה ב-`telegram_bot_state` עבור Yuval-Uzana.
4. האוטומציה "התראה לטלגרם" מתחילה לעבוד מיד (היא כבר מקונפגת עם chat_id `6267185334` של יובל).

### תוצאה צפויה
הליד הבא שייכנס דרך הסנכרון האוטומטי לארגון Yuval-Uzana יפעיל את האוטומציה, ויובל יקבל הודעת טלגרם דרך @Afterleafbot עם פרטי הליד.

### קבצים שיתעדכנו
- migration חדש: עמודה `shared_from_state_id` ב-`telegram_bot_state` + RLS
- `src/components/forms/ShareTelegramConnectionSection.tsx` (חדש)
- `src/pages/TelegramSettings.tsx`
- `supabase/functions/trigger-automation/index.ts`
- `supabase/functions/telegram-send/index.ts`
- `supabase/functions/telegram-poll/index.ts`

