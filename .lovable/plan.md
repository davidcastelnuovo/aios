
# תוכנית: הפיכת מודול השיווק לפונקציונלי

## סקירה
היום המודול הוא בעיקר UI: יש pipeline, stages, ו-work_items, אבל אין מנוע שבאמת מריץ אותם, אין תבניות, אין טריגרים, ואין מדידת שימוש. נבנה את החסר ב-7 שלבים, מהיסוד למעלה.

---

## שלב 1 — תיקון השמירה (דחוף)

**הבעיה**: `WorkItemSidePanel` שומר אבל הגדרות agent/prompt בכרטיסי השלבים לא מתרעננות בקנבס אחרי שמירה. בנוסף, `StageConfigDialog` לא טוען agent חדש שנוצר ולא מציג מצב שמירה ברור.

**מה עושים**:
- אחרי `StageConfigDialog.handleSave` להפעיל `queryClient.invalidateQueries(["pipeline-stages", pipelineId])` כדי שה-PipelineCanvas יראה מיד את ההגדרות.
- להוסיף badge "✓ הוגדר" על stage שיש לו `agent_id` + `instructions` כדי שייראה בעין שזה נשמר.
- ב-WorkItemSidePanel לעבור מ-`onBlur` לשמירה debounced + טוסט "נשמר".

---

## שלב 2 — תבניות גלובליות (Global Defaults)

**מטרה**: להגדיר agent + prompt + tools פעם אחת ברמת הארגון, ולהחיל על כל לקוח חדש או על לקוחות קיימים.

**טבלה חדשה** `marketing_stage_templates`:
```text
id | tenant_id | track ('campaigns'|'seo_geo'|'social_organic')
   | stage_type ('strategy'|'copy'|'creative'|'target_*'|'measurement')
   | name | default_agent_id | default_approval_mode
   | default_instructions (text) | default_tools (jsonb) | default_target (jsonb)
   | is_system (boolean — תבניות מובנות שנשתל מראש)
```

**UI חדש**: דף `/t/:slug/marketing/templates` (טאב נוסף בכותרת המודול: "תבניות שיווק"):
- רשימת תבניות לפי טראק × stage_type, עם עורך זהה ל-StageConfigDialog.
- כפתור "החל על לקוח" → בוחר לקוח אחד או "כל הלקוחות" → ממזג לתוך `marketing_pipeline_stages.configuration` (merge ולא overwrite — אם הלקוח עשה override ידני, נשמר).
- בעת `ensurePipelineForClient` חדש: לטעון תבניות `is_system=false || is_system=true` ולמלא בהן את ה-stages במקום ה-defaults הקשיחים.

**Seed תבניות מובנות**: migration שמכניס תבניות מערכת לכל tenant עם system prompts מקצועיים (משחזר ומשפר את מה שכתבת קודם):
- **בריף**: "חוקר מותג שמייצר בריף שיווקי מובנה: קהל יעד, כאבים, הצעת ערך, טון..."
- **כתיבת תוכן**: "קופירייטר שכותב לפי הבריף, באורך/סגנון מתאים לערוץ..."
- **קריאייטיב**: "Art director שמייצר ויזואלים על בסיס הקופי..."
- **קמפיין/SEO/סושיאל**: prompts ייעודיים לכל ערוץ.
- **מדידה**: "אנליסט שמושך KPI מ-GA/Meta/GSC ומפיק סיכום שבועי."

---

## שלב 3 — מנוע ההרצה (Engine)

**טבלאות חדשות**:
- `marketing_runs` — ריצה של work_item דרך stage:
  ```text
  id | item_id | stage_id | tenant_id | status ('queued'|'running'|'awaiting_approval'|'completed'|'failed')
  | input (jsonb) | output (jsonb) | error | tokens_in | tokens_out | cost_usd
  | model | started_at | finished_at | created_by
  ```
- `marketing_assets` — פלטים שנוצרו (טקסטים, תמונות, וידאו):
  ```text
  id | item_id | run_id | type ('copy'|'image'|'video') | url | content (text) | meta (jsonb) | created_at
  ```

**Edge Function: `marketing-run-stage`**
- קלט: `{ item_id, stage_id }`.
- טוען stage + agent + configuration + client connections.
- בונה prompt: `system_prompt` של ה-agent + `configuration.instructions` + הקשר על הלקוח (website, brand, מאגר ידע) + הפלטים מהשלבים הקודמים (מתוך `marketing_assets` של אותו item).
- מפעיל לפי `stage_type`:
  - `strategy/copy` → Lovable AI Gateway `streamText` עם `google/gemini-3-flash-preview`.
  - `creative` → image gen (`google/gemini-3-pro-image-preview` דרך AI Gateway), שומר ל-Supabase Storage bucket `marketing-assets`.
  - `target_*` → קורא ל-edge function ייעודי (ראה שלב 4).
  - `measurement` → שולף נתונים מאינטגרציות קיימות ומסכם.
- שומר run + assets, מעדכן `tokens_in/out` ו-`cost_usd`.
- אם `approval_mode='auto'` → מתקדם אוטומטית ל-stage הבא דרך `marketing_item_transitions`. אם `manual` → סטטוס `awaiting_approval`.

**Edge Function: `marketing-run-pipeline`**
- מקבל `item_id`, מריץ את כל ה-stages לפי הסדר, עוצר ב-`awaiting_approval`.

---

## שלב 4 — Targets (פרסום אמיתי)

לכל target_* edge function שבונה על האינטגרציות הקיימות:
- **target_paid** → `marketing-publish-paid`: יוצר פרסומת ב-Meta/Google Ads (draft) באמצעות חשבונות שכבר מחוברים בכרטיס הלקוח. בשלב הראשון: יוצר בלבד (paused), הפעלה ידנית.
- **target_seo** → `marketing-publish-seo`: שולח כפוסט WordPress דרך אינטגרציית WP הקיימת.
- **target_organic** → `marketing-publish-social`: דוחף ל-`social_publications` ולמערכת הסושיאל הקיימת (כבר יש publishing logic).

---

## שלב 5 — UI להפעלה (Play)

ב-`PipelineCanvas` ו-`WorkItemSidePanel`:
- כפתור **▶ Play** על כל work_item → קורא ל-`marketing-run-pipeline`.
- כפתור Play על כל stage בתוך work_item → קורא ל-`marketing-run-stage`.
- מצב ריצה חי: subscription על `marketing_runs` עם realtime, הצגת spinner על ה-stage שרץ עכשיו.
- מסך אישור: ב-`awaiting_approval` נפתח dialog עם הפלט (טקסט/תמונה) + כפתורים "אשר ושלח לשלב הבא" / "ערוך" / "הרץ מחדש".

**לוח תוכן**: `MarketingCalendarView` יציג גם את ה-assets האחרונים (תמונה ממוזערת + קופי) ויאפשר לחיצה לעריכה.

**לוח קריאייטיב חדש**: טאב נוסף "קריאייטיב" שמציג גריד של כל ה-`marketing_assets` מסוג image/video עבור הלקוח, עם פילטר לפי טראק.

---

## שלב 6 — טריגרים ותזמון

**טבלה חדשה** `marketing_triggers`:
```text
id | tenant_id | client_id | pipeline_id | name
| trigger_type ('schedule'|'event'|'manual')
| schedule_cron (text — '0 9 * * 1' = כל יום שני 09:00)
| schedule_preset ('daily'|'weekly'|'monthly')
| event_type (text — 'new_lead', 'campaign_underperforming', ...)
| template_payload (jsonb — title prefix, default stage, channel)
| is_active | last_run_at | next_run_at
```

**Edge Function: `marketing-trigger-tick`** (cron כל דקה דרך pg_cron):
- שולף triggers שב-`next_run_at <= now()`.
- יוצר `marketing_work_items` חדש לפי ה-template_payload.
- מפעיל `marketing-run-pipeline` עליו.
- מעדכן `next_run_at` לפי ה-cron הבא.

**UI טריגרים**: דף `/t/:slug/marketing/:clientId/triggers` (טאב נוסף):
- רשימת טריגרים לכל לקוח + טראק.
- אשף יצירה: בחר track → בחר תזמון (יומי/שבועי/חודשי + שעה) → תבנית כותרת → אישור.
- toggle Active/Inactive.

---

## שלב 7 — מדידת טוקנים ועלויות

**View**: `marketing_usage_stats` שמסכם מ-`marketing_runs`:
- per tenant / per client / per agent / per stage_type / per יום.
- `total_tokens_in`, `total_tokens_out`, `total_cost_usd`, `runs_count`, `success_rate`.

**UI**: דף `/t/:slug/marketing/usage` עם:
- כרטיסי KPI (סה"כ טוקנים החודש, עלות מצטברת, מספר ריצות, אחוז הצלחה).
- גרף Recharts: שימוש לאורך זמן (line) + פילוח לפי stage_type (stacked bar).
- טבלה: top לקוחות לפי שימוש.
- אזהרה ויזואלית כשמתקרבים למכסה (קונפיג ב-`tenant_settings`).

קריאות ל-AI Gateway יחזירו את ה-`usage` ב-`onFinish`; נחשב cost לפי טבלת תמחור פנימית למודלים נפוצים.

---

## פרטים טכניים

**Migrations**:
1. `marketing_stage_templates` + seed תבניות מערכת + GRANT + RLS.
2. `marketing_runs` + `marketing_assets` + GRANT + RLS.
3. `marketing_triggers` + GRANT + RLS + pg_cron job ל-`marketing-trigger-tick`.
4. View `marketing_usage_stats`.
5. Storage bucket `marketing-assets` (public read לתצוגה, write רק שרת).

**Edge Functions חדשות** (Lovable AI Gateway, model ברירת מחדל `google/gemini-3-flash-preview`):
- `marketing-run-stage`
- `marketing-run-pipeline`
- `marketing-publish-paid` / `marketing-publish-seo` / `marketing-publish-social`
- `marketing-trigger-tick` (cron)

**רכיבים חדשים**:
- `MarketingTemplatesPage`, `StageTemplateEditor`
- `MarketingTriggersPage`, `TriggerEditDialog`
- `MarketingUsagePage`, `UsageCharts`
- `CreativeBoard` (טאב חדש במחלקת שיווק)
- `RunStatusOverlay` ב-PipelineCanvas
- `ApprovalDialog`

**RLS**: כל הטבלאות מפולטרות לפי `tenant_id` עם `get_user_tenant_id()`. super_admin מורשה כרגיל.

**סדר ביצוע מומלץ**: שלב 1 → 2 → 3 → 5 → 7 → 4 → 6. ככה אחרי שלב 3 כבר רואים שהמודול "כותב תוכן" באמת, ושאר השלבים מוסיפים שכבות.

---

## מה חסר/שאלות פתוחות

לפני יישום, תאשר:
1. **תקציב טוקנים**: לקבוע cap חודשי per tenant? (אם כן — אבנה enforcement, אחרת רק תצוגה).
2. **פרסום ממומן**: לעצור ב-draft או באמת לשגר לאוויר? (ממליץ draft + אישור ידני בשלב ראשון).
3. **מאגר ידע**: רוצה שה-agent ימשוך מ-`agent_knowledge_items` הקיים? (ממליץ כן).
4. **סדר**: לאשר את סדר הביצוע למעלה, או להתחיל ממקום אחר?
