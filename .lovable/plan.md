## למה כרמן עכשיו קוראת ל-`delegate_to_github_agent` ושוב נכשלת

בצילום רואים: לבקשה "בדיקת דופק לכל הלקוחות בארגון" כרמן הריצה `delegate_to_github_agent` (וקודם לכן שיחזרה זיכרון), וזה נכשל ב-Unauthorized.

זו בדיוק אותה תקלה שתיקנו אתמול ב-`manus-api`, אבל ב-edge function אחר:
- `supabase/functions/github-agent/index.ts:44-47` עושה `supabase.auth.getUser(token)`.
- `run-ai-agent` קוראת ל-`github-agent` עם `Bearer SUPABASE_SERVICE_ROLE_KEY`.
- service-role JWT אין לו user → 401 Unauthorized.

חוץ מזה, `delegate_to_github_agent` הוא בכלל הכלי הלא נכון לבקשה הזו — הוא מיועד לניתוח שגיאות קוד / תמיכה טכנית, לא לבדיקת דופק לקוחות. ברגע שחסמנו אתמול את `delegate_to_subagent` ואת `delegate_to_manus` ב-AIOS, המודל פשוט קפץ לכלי ה"ברקע" הבא ברשימה — `delegate_to_github_agent`. צריך לסגור גם אותו בנתיב הזה, ולחזק את ההנחיה ש"בדיקת דופק" חייב לרוץ ישירות עם `analyze_campaign_performance`.

### תוכנית תיקון

**1. `supabase/functions/github-agent/index.ts`**
זיהוי קריאה פנימית עם service-role (אותו דפוס שהפעלנו ב-`manus-api` אתמול): אם `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` — דלג על `auth.getUser` והמשך עם הקליינט הקיים שמשתמש ב-service-role. אחרת אימות משתמש רגיל.

**2. `supabase/functions/run-ai-agent/index.ts` — פילטר AIOS**
ב-`surface === 'aios'`, להוסיף ל-`filteredTools` הסתרה של `delegate_to_github_agent` כברירת מחדל, ולחשוף אותו רק אם המשתמש כתב במפורש `github / שגיאה / קוד / אגנט` (היוריסטיקה דומה ל-Manus). ככה למילים "בדיקת דופק / דוח / לקוחות" לא יהיה כלי "ברקע" זמין בכלל, והמודל יחזור ל-`analyze_campaign_performance`.

**3. `supabase/functions/_shared/carmen-prompt-v2.ts`**
להוסיף שורה מפורשת: `🚫 אסור להשתמש ב-delegate_to_github_agent ל"בדיקת דופק" / "סיכום לקוחות" / "מצב קמפיינים" — הוא רק לתמיכה טכנית בקוד.`

**4. אימות**
אחרי deploy: לשלוח שוב "בדיקת דופק לכל הלקוחות בארגון" ולוודא בלוגים של `run-ai-agent` שמופיע `Tool call: analyze_campaign_performance` ולא delegation, ושהתשובה למשתמש מכילה דאטה אמיתי במקום הודעה על ריצה ברקע.

### קבצים שיתעדכנו
- `supabase/functions/github-agent/index.ts` — בייפס auth ל-service-role (תיקון Unauthorized)
- `supabase/functions/run-ai-agent/index.ts` — הסתרת `delegate_to_github_agent` ב-AIOS אלא אם נתבקש מפורשות
- `supabase/functions/_shared/carmen-prompt-v2.ts` — איסור מפורש על השימוש בו לבדיקות פנימיות
