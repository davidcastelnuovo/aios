# תכנית בנייה: Carmen Studio + Orchestration

> מסמך אפיון (PRD + ארכיטקטורה). **שלב תכנון בלבד — אין שינוי קוד.**
> גישה: **איחוד הדרגתי (Strangler Fig)**. MVP ראשון: **Campaign Pulse** (שיווק).
> תאריך: 2026-06-24

---

## 0. תקציר מנהלים

המערכת תתפצל לשני מודולים בעלי גבול ברור:

1. **Carmen Studio** (מודול *בניית הסוכן* — נפרד). כאן בונים את כרמן: נשמה/אישיות, מצבי רוח, הנחיות כלליות, הכלים שמותר לה, האינטגרציות שהיא מתחברת אליהן — וה**סקינז** שלה (קופירייטרית, SEO, כותבת תוכן, קמפיינרית, איש כספים…). **אין יותר "ריבוי סוכנים".** סוכן אחד (כרמן) שמחליף סקין לפי המשימה.

2. **Orchestration** (מודול *תזמור* — איחוד של *אוטומציות* + *ניהול משימות סוכנים* תחת קורת גג אחת). כאן בונים פלואו ויזואלי, מתזמנים משימות, ורואים הרצות. כרמן עצמה היא צומת בפלואו, ויכולה **לבנות / לערוך / להריץ אוטומציות בעצמה — באישור**.

**העיקרון הארכיטקטוני המרכזי:** במקום N סוכנים עם N system-prompts (דפוס n8n הקלאסי של "סוכן לכל אחריות"), אנחנו ממשים את אותו עקרון *Single Responsibility* כ-**החלפת סקין על סוכן יחיד**. זול יותר (זיכרון/נשמה משותפים), קל יותר לתחזוקה, ומנצל מבנה שכבר קיים ב-DB (`ai_skills`).

---

## 1. הממצא: רוב השלד כבר קיים

מתוך סריקת הקוד וה-dump (`agents_dump.sql`, tenants MarketingCaptain + DMM):

### מה שכבר בנוי ועובד
| רכיב | מצב | מקור |
|---|---|---|
| כרמן כסוכן יחיד | ✅ `ai_agents` (שורה אחת, engine `gpt-5.4`, `soul`/`talent`/`personality`, `system_prompt`, `writing_style`, `language=he`, `allowed_tools`) | dump |
| **סקינז** | ✅ **`ai_skills`** — `name, description, steps, trigger_phrases, system_prompt, output_template, allowed_tools, scope, model, triggers, created_by_agent, slug, version, usage_count, success_rate`. כבר 2 סקינז: "דוחות", "בדיקת דופק" | dump |
| הפעלת סקין פר-משימה | ✅ `agent_tasks.task_skills[]` + `_shared/skills/registry.ts` (`resolveActiveSkills`, `buildSkillsBlock`) | קוד |
| ניהול משימות | ✅ `agent_tasks` (94 שורות; `parallel_execution`, `parallel_subtasks`, `schedule_type`, `cron_expression`) | dump+קוד |
| משימות מקביליות | ✅ `delegate_to_background` כבר בשימוש בתוך steps של סקין "בדיקת דופק" | dump |
| הרצות + trace | ✅ `agent_runs` + `agent_action_log` (thought/observation/tokens/cost) | קוד |
| supervisor / fan-out | ✅ `run-agent-supervisor` עושה `Promise.all` ל-child agents | קוד |
| מנוע אוטומציות ויזואלי | ✅ React Flow (`@xyflow/react` v12) — `FlowEditor`, `automation_flow_steps` עם `parent_step_id`/`condition_branch`, מנוע `trigger-automation` עם guards | קוד |
| צומת `agent` בתוך פלואו | ✅ קיים כסוג צעד ב-`FlowNode.tsx` | קוד |
| זיכרון | ✅ `carmen_memory_pointers` (2122), `carmen_memory_episodes` (135), `agent_memory` (143), `ai_memory` (10) | dump |

### הפער האמיתי (מה שצריך לבנות)
1. **שני מנועי הרצה ושני schedulers** — `trigger-automation` (אוטומציות, sequential) מול `dispatch-agent-tasks`/`run-agent-task` (משימות). צריך **מנוע אחד**.
2. **אין DAG אמיתי** — `automation_flow_steps` משתמש ב-`parent_step_id` (עץ), לא ב-edges. ענפים מקביליים אמיתיים + merge חסרים בליבת המנוע.
3. **אין מסך ניהול מאוחד** — `AgentTasksPage` (משימות) ו-`AutomationFlow` (אוטומציות) הם שני עולמות.
4. **כרמן לא יכולה לבנות/לערוך אוטומציות בעצמה** — אין tools של authoring + approval gate לכך.
5. **חסרים סקינז עסקיים** — יש 2; צריך ספרייה מלאה לסוכנות דיגיטל.
6. **מודול בניית הסוכן מפוזר** — `AgentEditor` עם 13 טאבים מערבב בנייה (Profile/Tools/MCP) עם תפעול (Tasks/Runs/Approvals). צריך להפריד.

---

## 2. ארכיטקטורת היעד — שני מודולים

```
┌─────────────────────────────┐     ┌──────────────────────────────────────┐
│   MODULE A: Carmen Studio    │     │   MODULE B: Orchestration            │
│   (בניית הסוכן — נפרד)        │     │   (אוטומציות + משימות — מאוחד)         │
├─────────────────────────────┤     ├──────────────────────────────────────┤
│ • Core: נשמה/אישיות/כישרון    │     │ • Canvas ויזואלי (DAG)                 │
│ • מצבי רוח (mood)            │ →   │ • Triggers / Actions / Logic / Agent   │
│ • הנחיות כלליות              │ uses│ • צומת "Carmen" שטוען סקין             │
│ • כלים (allowed_tools)       │     │ • Fan-out מקבילי + Merge               │
│ • אינטגרציות (MCP/connections)│     │ • Tasks = View על runs                │
│ • SKINS manager (ai_skills): │     │ • Scheduler אחד                       │
│   קופי / SEO / תוכן /         │     │ • Carmen authoring (build/edit/run)    │
│   קמפיינרית / כספים …        │     │   — באישור                            │
└─────────────────────────────┘     └──────────────────────────────────────┘
         מגדיר "מי" כרמן                    מגדיר "מה" כרמן עושה ומתי
```

**הגבול המנחה:** Studio = *זהות ויכולות* (סטטי, נדיר משתנה). Orchestration = *עבודה* (דינמי, רץ כל הזמן). סקין נבנה ב-Studio, נצרך ב-Orchestration.

---

## 3. מודול A — Carmen Studio (בניית הסוכן)

מסך ייעודי, נפרד מהתפעול. ארבעה אזורים:

### 3.1 Core (הנשמה)
שדות קיימים ב-`ai_agents`: `personality`, `soul`, `talent`, `system_prompt`, `engine`, `language`, `writing_style`, `response_length`, `max_tool_rounds`. כאן רק לארגן ל-UI נקי.

### 3.2 מצבי רוח (Moods)
עמודת `mood` הקיימת (`fun|focused|tired|angry|random|NULL`) — tone-only, לעולם לא דורס חוקים קשיחים. נשאר כפי שהוא, מקבל UI ב-Studio.

### 3.3 כלים ואינטגרציות
- **כלים:** `agent_tools` (registry) + `ai_agents.allowed_tools`. מתג enable/disable פר-כלי.
- **אינטגרציות:** `agent_mcp_connections` + `tenant_integrations`. כאן כרמן "מתחברת" ל-Facebook Ads, Ahrefs, Gmail, Gamma, higgsfield, Make, Supabase וכו'. ה-MCP-ים כבר מחוברים בסביבה — צריך לחשוף אותם כ-tools לכרמן.

### 3.4 SKINS Manager (לב המודול)
מבוסס 100% על `ai_skills` הקיים. כל סקין:

| שדה | תפקיד |
|---|---|
| `name` / `slug` | "קופירייטרית", "SEO" … |
| `description` | מתי להשתמש |
| `system_prompt` | טון + persona של הסקין (נדבך מעל הנשמה של כרמן) |
| `steps` | הפרוצדורה (כמו שכבר כתוב ב"בדיקת דופק") |
| `allowed_tools` | תת-קבוצת כלים שהסקין מורשה (Single Responsibility) |
| `output_template` | פורמט פלט קבוע |
| `trigger_phrases` / `triggers` | בחירה אוטומטית של הסקין לפי בקשה/טריגר |
| `model` | אפשר מודל שונה פר-סקין (זול לקופי, חזק לאסטרטגיה) |
| `usage_count` / `success_rate` | טלמטריה לשיפור |

**מנגנון בחירת סקין** (כבר חצי-קיים): פר-משימה/צומת אפשר (א) להצמיד סקין מפורשות, או (ב) שכרמן תבחר אוטומטית לפי `trigger_phrases`. `buildSkillsBlock` כבר מזריק את הסקין הפעיל ל-system prompt.

> **למה סקינז ולא סוכנים:** סוכן נפרד = נשמה/זיכרון/הגדרות משוכפלים, יקר לתחזק. סקין = שכבת persona+procedure+tools דקה מעל כרמן אחת. אותו עקרון "אחריות אחת לכל יחידה" של n8n, בעלות נמוכה בהרבה.

---

## 4. מודול B — Orchestration (אוטומציות + משימות)

### 4.1 העיקרון: Workflow = DAG של Nodes
```
Workflow ─┬─ Node(trigger)
          ├─ Node(action)         ← דטרמיניסטי (שלח WhatsApp, צור משימה)
          ├─ Node(agent+skin)     ← כרמן טוענת סקין ומבצעת
          ├─ Node(condition/switch)
          ├─ Node(parallel)       ← fan-out לענפים
          ├─ Node(merge)          ← fan-in / barrier
          └─ Node(human_approval) ← gate
```

**האיחוד המושגי:**
- `automation_flow_step` מסוג `agent` ≡ `agent_task` → **אותה ישות**. צעד-סוכן בפלואו *הוא* משימת סוכן.
- `automation_logs` ≡ `agent_runs` → **אותה ישות**. כל הרצת node = run עם trace.
- `dispatch-agent-tasks` + טריגרי `scheduled_*` → **scheduler אחד**.
- "Tasks / Recurring / Goals / Stats" = **views** מסוננים על אותם runs, לא מערכת נפרדת.

### 4.2 מודל הנתונים המאוחד
```
workflows            ← הרחבת automations (trigger config, status, tenant, is_flow)
  ├─ workflow_nodes   ← הרחבת automation_flow_steps
  │     type: trigger|action|agent|condition|switch|delay|parallel|merge|
  │           loop|code|human_approval
  │     skin_id → ai_skills(id)   ← חדש: איזה סקין הצומת טוען
  └─ workflow_edges   ← חדש! source_node, target_node, branch_label, condition
                         (מחליף parent_step_id → DAG אמיתי)

workflow_runs        ← איחוד automation_logs + agent_runs
                         (+ idempotency_key, parent_run_id, total_cost)
  └─ run_steps        ← איחוד step-logs + agent_action_log
                         (node_id, input, output, thought, observation, tokens)
```
**Backward-compat (Strangler):** `agent_tasks` ו-`automation_logs` נשארים כ-**views** על המבנה החדש. שום צרכן קיים לא נשבר.

### 4.3 מנוע הרצה אחד — `workflow-executor`
התפתחות של `trigger-automation`:
- **Topological execution** — מריץ צומת כשכל ה-edges הנכנסים אליו הושלמו.
- **Fan-out מקבילי** — צומת `parallel`/כמה edges יוצאים → `Promise.all`. הלוגיקה כבר קיימת ב-`run-agent-supervisor`; מחלצים ל-`_shared/dag.ts`.
- **Merge / barrier** — צומת `merge` ממתין לכל הענפים.
- **Checkpoint + idempotency** (Temporal pattern) — כל `run_step` נשמר עם input/output ו-`idempotency_key`; resume אחרי crash בלי הרצה כפולה.
- **Retry + backoff** בשכבת המנוע, רק על פעולות idempotent.
- שמירת ה-guards הקיימים: `MAX_EXECUTION_DEPTH`, loop-detection, WhatsApp cooldown.

### 4.4 Canvas
- מעבר ל-**Zustand** ל-state (הגרף יגדל).
- **auto-layout** עם ELK.js/Dagre (כפתור "סדר").
- **node-palette**: Triggers / Actions / Logic / **Carmen (skin)** / AI-Content / Integrations.
- **Live run overlay** — צביעת צמתים בזמן ריצה (running/done/failed) + token/cost. איחוד `ExecutionHistoryPanel` + `RunsTab`.

---

## 5. כרמן בונה/עורכת/מריצה אוטומציות בעצמה (באישור)

יכולת ייחודית: כרמן authoring. tools חדשים לכרמן:
- `create_workflow(name, trigger, nodes[], edges[])`
- `edit_workflow(id, patch)`
- `run_workflow(id, input)` / `activate_workflow(id)`

**Approval gate (חובה):** כל פעולת authoring שכרמן מייצרת נכנסת ל-`agent_approval_queue` (קיים!) עם `proposed_changes` (diff של הפלואו). המשתמש רואה preview ויזואלי על ה-Canvas → approve/reject → רק אז המנוע מבצע. בדיוק כמו ה-approval הקיים לפעולות רגישות.

זרימה: *"כרמן, תבני לי אוטומציה שכל בוקר בודקת קמפיינים ושולחת דוח"* → כרמן מרכיבה DAG → מציעה ב-approval queue → אתה מאשר על הקנבס → פעיל.

---

## 6. תכנית בנייה צעד-אחר-צעד (Strangler, 6 פאזות)

### Phase 0 — יישור ותשתית (שבוע 1)
1. מינוח אחיד: `workflow/node/edge/run/step` בכל הקוד.
2. הפרדת UI: `AgentEditor` → **Carmen Studio** (Core/Moods/Tools/Integrations/**Skins**) ⟂ תפעול עובר ל-Orchestration.
3. מיגרציה: `workflow_edges` + `idempotency_key` + `run_steps` מאוחד. Views ל-`agent_tasks`/`automation_logs`.

### Phase 1 — מנוע DAG אחד (שבועות 2–3)
4. `workflow-executor`: topological + checkpoint + idempotency. חילוץ fan-out מ-`run-agent-supervisor` ל-`_shared/dag.ts`.
5. צמתי `parallel` + `merge` אמיתיים; הגירת `loop`/`switch`.
6. **scheduler אחד** — איחוד `dispatch-agent-tasks` + `scheduled_*`.

### Phase 2 — סקינז כאזרח מהמעלה הראשונה (שבועות 4–5)
7. צומת `agent` מקבל `skin_id`; טוען סקין דרך `buildSkillsBlock` עם context מצמתים קודמים.
8. בניית **ספריית הסקינז** לסוכנות דיגיטל (חלק 8).
9. בחירת סקין אוטומטית לפי `trigger_phrases` + הצמדה ידנית.

### Phase 3 — Canvas מאוחד + Carmen authoring (שבועות 6–7)
10. Zustand + ELK.js auto-layout + node-palette + live overlay.
11. tools של authoring לכרמן + approval gate ויזואלי (חלק 5).
12. "Tasks/Recurring/Goals/Stats" → views על `workflow_runs`. מסך אחד.

### Phase 4 — MVP Campaign Pulse + תבניות (שבועות 8–9)
13. מימוש Campaign Pulse מקצה-לקצה (חלק 9).
14. Template gallery + חיבור MCP-ים כ-nodes (Facebook/Ahrefs/Gamma/higgsfield/Gmail/Make).

### Phase 5 — Hardening (שבוע 10)
15. Observability per-node (latency/error/cost). Queue mode אם הווליום גדל.
16. Evals על workflows (הרחבת `agent_evals`). Versioning + שיתוף בין tenants (`automation_shared_tenants` קיים).

---

## 7. עקרונות מאופן-סורס שמיושמים כאן
- **DAG execution** (n8n) — גרף עם תלויות מפורשות, data בין צמתים.
- **Single Responsibility per unit** (n8n multi-agent) — אצלנו = סקין צר עם `allowed_tools` ממוקד.
- **Agent-as-Tool / sub-workflow** (n8n) — צומת-סוכן יכול לקרוא לסקין אחר כתת-משימה.
- **Durable execution** (Temporal) — event-history, checkpoint/resume, idempotency keys, retry+backoff.
- **Canvas patterns** (React Flow) — Zustand, ELK.js auto-layout, memoization, conditional routing.

---

## 8. ספריית הסקינז לסוכנות דיגיטל (`ai_skills`)

כל סקין = שורה ב-`ai_skills`. סט ההתחלה:

| סקין | `allowed_tools` עיקריים | אינטגרציות | פלט אופייני |
|---|---|---|---|
| **קופירייטרית** | gen_text, brand_voice, save_asset | — | פוסט/מודעה/מייל בטון מותג |
| **SEO** | Ahrefs (keywords/SERP/site-audit), gen_text | Ahrefs MCP | מחקר מילים, brief, מטא |
| **כותבת תוכן** | gen_text, gen_image, Gamma, save_asset | Gamma, higgsfield | מאמר/ניוזלטר/מצגת |
| **קמפיינרית** | Facebook Ads (insights/create/toggle/budget), analyze_campaign_performance | facebook_ads MCP | אופטימיזציה, מודעות חדשות, התראות |
| **איש כספים** | get_client_billing, spend reports, invoices | — | דוח spend/ROI, חריגות תקציב |
| **אנליסטית** | web-analytics, GSC, campaign data | Ahrefs, Facebook | תובנות cross-channel |
| **מנהלת לקוח (CS)** | client health, add_client_update, send_message | WhatsApp/Telegram | בדיקת דופק, נטישה |
| **SDR / מכירות** | lead enrich/score, send_message, create_task | WhatsApp | פתיחת ליד, ניקוד, nurture |

> 2 הסקינז הקיימים ("דוחות", "בדיקת דופק") הם בעצם וריאציות של אנליסטית/CS — נשמרים ומשתלבים.

**עיקרון:** סקין מחזיק רק את ה-tools שהוא צריך. קמפיינרית לא נוגעת ב-Ahrefs; SEO לא נוגעת ב-budget. זה ה-Single Responsibility — אבל על סוכן אחד.

---

## 9. MVP: Campaign Pulse (שיווק) — מפורט

**מטרה:** להוכיח את שלוש היכולות הקריטיות בבת אחת — (א) fan-out מקבילי של סקינז, (ב) merge+סינתזה, (ג) approval על פעולה.

```
Trigger: scheduled_daily 08:00
   │
   ├─⚡ Node(agent, skin=קמפיינרית)
   │     Facebook MCP: משוך ביצועי 7 ימים מול קודם, zהה anomaly/חריגת תקציב
   │
   ├─⚡ Node(agent, skin=SEO)
   │     Ahrefs MCP: שינויי דירוג, backlinks חדשים, site-audit issues
   │
   └─⚡ Node(agent, skin=אנליסטית)
         web-analytics: תנועה, מקורות, conversions
   │
   ▼ Node(merge)  ← barrier: ממתין ל-3 הענפים
   │
   ▼ Node(agent, skin=אנליסטית "CMO-Synth")
   │     מסנתז את 3 הפלטים → תובנות + 3 המלצות מתועדפות
   │
   ▼ Node(condition): חריגת תקציב מהותית?
   │     כן → Node(human_approval): "להעלות/לעצור קמפיין X?" → toggle/budget
   │     לא → דלג
   │
   ▼ Node(action): שלח דוח WhatsApp/Telegram (פורמט output_template)
```

**למה זה ה-MVP הנכון:**
- מדגים "סוכנים במקביל" באופן שלא ניתן לפספס (3 סקינז בו-זמנית).
- משתמש ב-MCP-ים שכבר מחוברים (Facebook, Ahrefs).
- ה-approval gate על שינוי תקציב = הוכחה ל"כרמן פועלת באישור".
- קצר מספיק לפאזה אחת, אמיתי מספיק לערך עסקי יומי.

**הגדרת "הצלחה" ל-MVP:**
1. שלושת הסקינז רצים במקביל (לא סדרתית) — נמדד ב-`run_steps.started_at`.
2. ה-merge ממתין לכל השלושה לפני הסינתזה.
3. חריגת תקציב פותחת approval, ורק אישור מבצע את ה-toggle.
4. הדוח מגיע ל-WhatsApp בפורמט אחיד.

---

## 10. סיכונים והחלטות פתוחות
1. **מנוע `gpt-5.4`** ב-`ai_agents` — לאמת זמינות/עלות מול הסטנדרט בפרויקט (`gpt-4o-mini`). אולי model פר-סקין.
2. **Idempotency על פעולות חיצוניות** (שליחת WhatsApp, שינוי budget) — קריטי למנוע כפילויות ב-retry.
3. **עומק fan-out** — להגדיר תקרת מקביליות לכל workflow (כמו cap של 16 ב-orchestration).
4. **הגירת `parent_step_id` → edges** — סקריפט המרה לאוטומציות קיימות; לשמור fallback.
5. **scope של סקין** — `ai_skills.scope` (`tenant`) מול הרשאות משתמש (campaigner/manager/owner) שכבר מופיעות ב-steps. ליישר עם RLS.
6. **גבול Studio↔Orchestration** — סקין נבנה ב-Studio בלבד; Orchestration רק *צורך* `skin_id`. לא לאפשר עריכת סקין מתוך פלואו (אחרת הגבול נמרח).

---

*נכתב כשלב תכנון. אין שינוי בקוד היישום. המימוש מתחיל ב-Phase 0 לפי אישור.*
