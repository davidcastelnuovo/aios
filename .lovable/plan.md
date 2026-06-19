## למה כרמן בחרה ב-Manus, ולמה זה נכשל ב-Unauthorized

### למה היא בחרה ב-Manus
עד היום, הכלי `delegate_to_manus` היה תמיד זמין לכרמן (גם ב-AIOS). כש-בקשה הייתה "כבדה" (יותר מ-5 לקוחות, בדיקת דופק וכו'), המודל פשוט בחר במסלול "ברקע" — `delegate_to_manus` — כי זה הכלי היחיד שתואר כ-"רץ ברקע ולוקח דקות עד שעות". הוא לא היה צריך טריגר מילולי, רק היוריסטיקה של המודל.

בתיקון של היום הוספתי פילטר ב-`run-ai-agent` (שורות 2163–2175) שמסתיר את `delegate_to_manus` ב-AIOS אלא אם המשתמש כתב במפורש "manus / מנוס / ברקע". זה התיקון להתנהגות, אבל **זה לא מתקן את Manus עצמו**.

### למה ה-API מחזיר Unauthorized — זה באג, לא מפתח לא תקין
מצאתי את שורש הבעיה (וזה היה ככה גם קודם, גם כשנדמה היה שזה "עבד"):

1. `run-ai-agent/index.ts:448-455` קורא ל-`manus-api` עם:
   ```
   Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}
   ```
2. `manus-api/index.ts:17-28` מריץ:
   ```
   supabaseClient.auth.getUser()
   ```
   על ה-token. service-role JWT הוא לא משתמש אנושי — אין לו `sub`/user, אז `getUser()` מחזיר `Unauthorized` ו-`manus-api` עוצר עוד לפני שהוא בכלל מנסה לקרוא ל-`api.manus.ai`.

כלומר: **מפתח ה-Manus API שלך תקין לחלוטין**. הוא בכלל לא נבדק. הקריאה נופלת בשלב האימות הפנימי בין שתי edge functions שלנו, לפני יציאה ל-Manus.

עדות בלוגים: `[AGENT] Tool delegate_to_manus` מסתיים מיידית עם `Manus API error: {"error":"Unauthorized"}` — זו בדיוק ההודעה ש-`manus-api` מחזיר ב-401 משלו, לא ש-Manus החזירה.

זה ככל הנראה היה שבור גם קודם — מה ש"עבד" בעבר היו קריאות מה-UI (עם JWT אמיתי של משתמש), לא מתוך כרמן.

### תוכנית תיקון

**1. תקן את `manus-api` שיקבל קריאה פנימית עם service-role**
ב-`supabase/functions/manus-api/index.ts`:
- אם הכותרת `Authorization` היא ה-`SUPABASE_SERVICE_ROLE_KEY` (קריאה פנימית מ-`run-ai-agent`), דלג על `auth.getUser()` וקבל את הזהות מתוך הבקשה (ה-`tenantId` כבר נשלח). אחרת, התנהגות רגילה (אימות משתמש).
- ככה `delegate_to_manus` יזרום מכרמן → manus-api → api.manus.ai עם המפתח שמאוחסן ב-`tenant_integrations`.

**2. שפר את הודעת השגיאה ב-`delegate_to_manus`**
ב-`run-ai-agent/index.ts` סביב 437-470: כשהקריאה נכשלת, החזר הודעה שמבחינה בין:
- "Manus integration not configured" (אין שורה ב-`tenant_integrations`)
- "Manus API key not found" (יש שורה אבל בלי `api_key`)
- שגיאה אמיתית מ-`api.manus.ai` (כולל הסטטוס שהיא החזירה)

ככה אם זה ייפול שוב, נדע מיידית אם זה אצלנו או אצלם.

**3. השאר את הפילטר ב-AIOS שכבר נוסף**
זה נשאר כי גם אחרי התיקון Manus היא משימה של דקות-שעות. ל"בדיקת דופק" אנחנו רוצים תשובה מיידית. רק כשהמשתמש מבקש מפורשות ("מנוס" / "ברקע") הכלי ייחשף.

**4. אימות**
אחרי הפריסה: תפעילי "כרמן תשלחי ל-מנוס מחקר על X" — נוודא בלוגים של `manus-api` ש-`api.manus.ai` נקראת ושמתקבלת תשובה תקינה (task_id).

### קבצים שיתעדכנו
- `supabase/functions/manus-api/index.ts` — בייפס auth כשהקורא הוא service-role
- `supabase/functions/run-ai-agent/index.ts` — הודעות שגיאה מפורטות ב-`delegate_to_manus`
