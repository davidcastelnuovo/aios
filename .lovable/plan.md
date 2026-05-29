## מטרה
בסלקטור הצ׳אט (כיום: "צ׳אט / וואטסאפ / טלגרם / ManyChat / סוכני AI") — להוסיף אפשרות לבחור **חיבור ספציפי בשם שלו** (לדוגמה: "Manus – Carmen", "Green API – שיווק", "טלגרם – ראשי") במקום רק סוג הפלטפורמה.

## איך זה ייראה
דרופדאון מקובץ עם כותרות:

```text
✓ הכל
── וואטסאפ ──
   כל הוואטסאפ
   Manus · Carmen
   Manus · משרד
   Green API · שיווק
── טלגרם ──
   כל הטלגרם
   טלגרם · בוט ראשי
── ManyChat ──
   כל ה-ManyChat
── סוכני AI 🤖 ──
```

חיבורים ללא `display_name` יקבלו שם דיפולטיבי (לדוגמה "Manus WA"/"Green API" + 4 ספרות אחרונות של מספר/טוקן).

## איך זה יעבוד טכנית
1. **שליפת חיבורים זמינים**: hook חדש `useChatConnections()` ש-שולף מ-`tenant_integrations` את כל הרשומות מסוג `green_api`, `manus_wa`, `telegram`, `manychat` שהמשתמש רשאי לראות (own + shared דרך `integration_user_permissions`, בדיוק כמו `useUserIntegrations`).
2. **State בעמוד `Chat.tsx`**: להחליף את `platformFilter: "all" | "whatsapp" | ...` ב:
   ```ts
   type ChatFilter =
     | { kind: 'all' }
     | { kind: 'platform', platform: 'whatsapp' | 'telegram' | 'manychat' | 'agents' }
     | { kind: 'connection', integrationId: string, ownerUserId: string, provider: string }
   ```
3. **לוגיקת סינון** ב-`filteredContacts`:
   - `platform` — כמו היום (לפי `active_chat_provider`/`contact_type`).
   - `connection` — סינון כפול: `active_chat_provider === provider` **וגם** `connection_user_id === ownerUserId` של החיבור. (כיום ב-`chat_messages` יש `connection_user_id` אבל אין `integration_id`; השדות `provider + connection_user_id` מספיקים כדי לזהות חיבור ספציפי לכל מקרה ריאלי שראיתי בנתונים.)
   - ה-RPC `get_chat_contacts` כבר מסנן לפי `connection_user_id = auth.uid()`, אז כדי לראות צ׳אטים של חיבור משותף (בבעלות מישהו אחר) — נשנה את ה-RPC לקבל פרמטר אופציונלי `p_connection_user_id` ו-להשתמש בו במקום `auth.uid()`. רק אם המשתמש בעצם רשאי על אותו integration (נוודא RLS-style ב-function עצמה).
4. **UI**: רכיב חדש `ChatConnectionSelector` שמחליף את ה-`Select` הקיים בשתי הקריאות (שורות 559 ו-585 ב-`Chat.tsx`). שימוש ב-`Select` עם `SelectGroup`/`SelectLabel` קיימים מ-shadcn לכותרות לפי פלטפורמה.

## קבצים שישתנו
- חדש: `src/hooks/useChatConnections.ts`
- חדש: `src/components/chat/ChatConnectionSelector.tsx`
- ערכת מיגרציה: עדכון `get_chat_contacts` להוסיף `p_connection_user_id` אופציונלי.
- `src/pages/Chat.tsx`: state חדש, שימוש בסלקטור החדש, סינון לפי connection, העברת `p_connection_user_id` ל-RPC.

## מה לא משתנה
- עמודי הצ׳אט הספציפיים (`ChatView`, התראות) — ממשיכים לעבוד עם הקשר הנוכחי. רק רשימת הקונטקטים נחתכת.
- הסלקטור עדיין תומך באופציות הגנריות הקיימות ("כל הוואטסאפ", "טלגרם", "ManyChat", "סוכני AI") כברירות מחדל.
