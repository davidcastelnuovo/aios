# תכנית שיפור כרמן — אוקטובר 2026

> מבוסס על סריקת קוד (`run-ai-agent`, `_shared/agent-channel/*`) ומסמכי `carmen-capability-audit.md`, `carmen-reliability-plan.md`, `agent-brain-channels.md`, ועל שאילתת קריאה בלבד ב-Staging (6.10.2026). נתוני שימוש מ-Production לא נבדקו — דורש אישור של דוד.

## 1. מה כרמן אמורה לעשות

מנהלת התפעול של AIOS: כל מה שדוד עושה במערכת (משימות, יומן, דוחות, דופק, קמפיינים, כספים, אוטומציות, שירות לקוחות) — בכלים דטרמיניסטיים, עם אישור בפעולות רגישות, בוואטסאפ ובאפליקציה (כולל קול), ומסלול האצלה לסוכני קוד (Cursor / Grok / Codex / Claude) ופרלמנט שמתייעץ עם כולם.

## 2. מה היא מצליחה בפועל

| תחום | מצב | עדות |
| --- | --- | --- |
| משימות / יומן | עובד (~80–85%) | באג סטטוס `done`/`completed` (`run-ai-agent/index.ts:4925`), `update_task` לא מסנכרן יומן, אין זימון רב-משתתפים |
| כספים | חלקי | כלים חדשים (`get_accounting_overview`) קיימים, אבל כלי legacy עדיין חשופים ומבלבלים את המודל |
| Meta / Google Ads | קריאה טובה, כתיבה בשני נתיבי אישור | `agent_approval_queue` מול `confirmed=true` מיידי |
| אוטומציות | יצירה בלבד | אין עריכה / מחיקה / הרצת בדיקה |
| דופק | יקר ולא מוכח | ~90K טוקני קלט להפעלה, בלי קריאות כלים; עלות GPT-5 לא נמדדת |
| מנוע | מונוליט | `run-ai-agent/index.ts` = 8,416 שורות, 146 כלים, router שמצמצם ל-~55 |
| ערוצי מוח ישירים | **לא אמין** | ב-Staging: 27 סשנים חיצוניים תקועים ב-`running` בלי תשובה (Cursor 12, Grok 8, Codex 7) מול 14 שהושלמו; אין timeout או ניקוי |
| Claude Direct | **מעולם לא הופעל** | 0 סשנים של `claude` ב-Staging; הנתיב קיים (`launchClaude` → Routine `/fire`), כנראה חסרים `CLAUDE_ROUTINE_ID`/`TOKEN` |
| פרלמנט | Cursor + Grok + Codex בלבד | `launchParliamentSeat` זורק `Parliament seat not supported: claude` (`direct.ts:234`); ברירת המחדל לא כוללת את Claude |

## 3. התכנית — לפי סדר

### שלב 1 · Claude כמושב בפרלמנט (המבוקש, קטן ואדיטיבי)

1. `launchClaude(ctx, extraPrompt?, parliament?)` — לקבל `parliament`, לשמור `parliament_run_id` + `parliament_round` על `agent_channel_sessions`, ולהעביר `parliament_round` לבלוק ה-callback (כמו `launchCloudDirect`).
2. `launchParliamentSeat` — ענף `provider === "claude"` → `launchClaude`.
3. ברירת מחדל ל-seats: `["cursor","grok","codex","claude"]` (התקרה הקיימת היא 4), ושם הנתב: "שולחן אבירים · Cursor + Grok + Codex + Claude". ראוטים קיימים: עדכון `config.seats` ב-Staging בלבד, ואז Production באישור.
4. הגדרת Routine ייעודי ב-claude.ai על ריפו `aios` — פרומפט קבוע: "ענה ל-AIOS דרך ה-callback שבהודעה; read-only בזמן פרלמנט". סודות `CLAUDE_ROUTINE_ID` / `CLAUDE_ROUTINE_TOKEN` ב-Staging (דרך `copy-edge-secrets-to-staging`).
5. **רשת:** סביבת ה-Routine חייבת לאפשר יציאה ל-`*.supabase.co` (POST ל-`agent-channel-callback`), אחרת Claude עונה ואף אחד לא שומע. לבדוק ב-`channel_health`.
6. בדיקות: unit ל-`launchParliamentSeat("claude")` + פרלמנט מלא ב-Preview עם 4 מושבים, כולל סבב 2 (כל סבב = סשן Routine חדש; אין thread מתמשך).

**שלב 1ב (אופציונלי):** ערוץ סינכרוני ל-Claude דרך Anthropic Messages API (בלי ריפו, תשובה בשניות) למושב "יועץ" בפרלמנט, ו-Routine רק כשצריך קוד. החלטה של דוד: עלות API מול מהירות.

### שלב 2 · אמינות ערוצי המוח

1. Timeout לסשן חיצוני (למשל 20 דק׳ בפרלמנט, 2 שעות ב-Direct) → `failed` + הודעה בשיחה; פרלמנט ממשיך עם מושבים חיים.
2. ניקוי הסשנים התקועים הקיימים (Staging קודם).
3. `channel_health` שבודק לכל ספק: סוד קיים, probe עובר, callback אחרון מוצלח.
4. מדד הצלחה פר ספק: אחוז סשנים שחזרו עם תשובה, זמן תגובה חציוני.

### שלב 3 · באגים ופערי כלים קטנים

1. `complete_task_step` / `update_task_status` — לאחד ל-enum אחד.
2. `update_task` מסנכרן יומן; זימון רב-משתתפים.
3. להסתיר כלי `finance` legacy מהמודל.
4. נתיב אישור יחיד לפרסום — `agent_approval_queue` בלבד.
5. אוטומציות: עריכה / כיבוי / מחיקה / הרצת בדיקה, באישור.

### שלב 4 · עלות ודופק

1. `estimateLLMCostUSD` מכסה את כל הדגמים בשימוש; תעריף לא מוכר = חסר, לא אפס.
2. דופק ללא מודל: חישוב KPI בקוד, AI רק על חריגות (לפי `carmen-reliability-plan.md`).
3. Fast-path לפני טעינת הקשר וחיפושי embedding.

### שלב 5 · פירוק המונוליט

להוציא קבוצות כלים מ-`run-ai-agent/index.ts` למודולים (`tools/tasks.ts`, `tools/ads.ts`...) בשינויים קטנים ואדיטיביים, עם בדיקות לכל קבוצה. בלי שכתוב גדול.

## 4. מה צריך מדוד

- אישור לשאילתות קריאה בלבד ב-Production (מדדי הצלחה אמיתיים).
- יצירת Routine ב-claude.ai + טוקן, ואישור רשת ל-Supabase.
- החלטה על שלב 1ב (API ישיר).
- `מאשר לפרודקשן` לכל שלב אחרי אימות ב-Staging.
