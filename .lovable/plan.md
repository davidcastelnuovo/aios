# תכנית: Skills כ-DB-driven עם cache חכם

## עקרון
פורמט הפלט של "בדיקת דופק" (לפי הדוגמה ששלחת) ננעל כתבנית קבועה. תוכן הסקילז (system prompt + output template + tools allowed) עובר מהקוד ל-DB. שינוי סקיל = update בטבלה, **בלי deploy**, יעיל מיידית בכל ריצה.

## מה עושים

### 1. שימוש בטבלת `ai_skills` הקיימת (הרחבה)
מיגרציה תוסיף עמודות:
- `slug text unique` — מזהה יציב (`pulse_check`, `ecommerce_pulse`, `ad_accounts_health`)
- `system_prompt text` — הפרומפט עצמו
- `output_template text` — תבנית הפלט (הפורמט שאישרת למעלה)
- `allowed_tools text[]` — אילו tools הסקיל רשאי לקרוא
- `scope text` — `global` | `tenant`
- `model text` — אופציונלי (ברירת מחדל מהקונפיג)

`global` (ללא tenant_id) = סקילים שלי שמותקנים לכולם. `tenant` = סקילז מותאמים שלקוח יוצר.

### 2. Skill Loader עם cache
קובץ חדש `supabase/functions/_shared/skills/loader.ts`:
- `getSkill(slug, tenantId)` — שולף global + tenant override, ממזג, מחזיר.
- Cache in-memory ל-60 שניות לפי `(slug, tenant_id, version)`.
- Invalidation: כל update ב-`ai_skills` מקדם `version` (טריגר), ה-loader בודק version מול DB עם `SELECT version` קליל (single-row, indexed) — שינוי מורגש תוך שנייה.

### 3. שילוב ב-`run-ai-agent`
לפני הקריאה למודל:
1. זיהוי הסקיל לפי trigger (`bedikat dofek`, "בדיקת דופק", "פולס", "ecommerce pulse", "ad accounts health" וכו').
2. `getSkill(slug, tenantId)` → מזריק `system_prompt + output_template` לפרומפט, מגביל `allowed_tools`.
3. אם אין סקיל מתאים → התנהגות ברירת מחדל הקיימת.

### 4. Seed ראשוני (3 סקילז גלובליים)
מיגרציה תזריק:
- **`pulse_check`** — output_template = הפורמט שלך עם הקבוצות לפי סוכנות, אייקונים 🔴🟠🟢, "ללא חיבור דוחות", סיכום מהיר. tools: `analyze_campaign_performance`, `check_ad_accounts_health`, `list_clients`.
- **`ecommerce_pulse`** — purchases/CPP/revenue/profit/ROAS, טריגר אוטומטי כשלקוח `is_ecommerce=true`. tools: meta + woocommerce + shopify.
- **`ad_accounts_health`** — disabled/closed, no spend 7d, all paused, token expired. tools: `check_ad_accounts_health`.

### 5. UI לניהול סקילז (דף קיים `AISkillsManager` או חדש)
- רשימת סקילז (גלובליים מסומנים read-only למי שאינו super_admin).
- עריכת `system_prompt`, `output_template`, `allowed_tools` עם textarea + monaco-like.
- כפתור "Test" → קורא ל-`run-ai-agent` עם הסקיל ב-dry-run.
- שמירה = update + bump version. בעריכה הבאה של Carmen — הפרומפט החדש פעיל אוטומטית.

### 6. Deploy אוטומטי
אין מה לעשות ידני: שינוי שורה ב-DB → ה-loader מזהה version חדש → ריצה הבאה משתמשת בפרומפט החדש. אפס deploy.

## קבצים
**חדש:** `supabase/functions/_shared/skills/loader.ts`, מיגרציה (עמודות + seed + טריגר version).
**עריכה:** `run-ai-agent/index.ts` (skill resolver במקום פרומפטים hardcoded), `src/pages/AISkillsManager.tsx` (טופס עריכה מלא).
**מחיקה:** הפרומפטים שהיו אמורים להיות hardcoded (לא קיימים עוד) — במקום זה הכל ב-DB.

## טרמינולוגיה (מוסכמת מעכשיו)
- **Skill** = יחידת פרומפט+פורמט+tools, בעלת slug.
- **Surface** = איפה הסקיל נטען (chat / whatsapp / heartbeat).
- **Tool** = פונקציית JS שהמודל קורא (`analyze_campaign_performance` וכו').
- **Memory** = `ai_memory`/`agent_memory` — נשמר אוטומטית בטריגר `תזכרי/שימי לב/...`.
- **Episode** = רשומת `carmen_memory_episodes` — אירוע ספציפי שקרה.
- **Action log** = `agent_action_log` — מה כרמן עשתה בריצה.

מאשר ומיישם?