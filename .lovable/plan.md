## Visual Workspace — מודול חדש ומבודד (MVP)

יושב ליד ה-CRM הקיים, לא נוגע בו. נתיב חדש בלבד, טבלה חדשה בלבד, קריאות SELECT בלבד למה שכבר קיים.

### עקרון בטיחות מוחלט
- אין שינוי, refactor או מחיקה של קבצים/טבלאות/אוטומציות/הרשאות קיימים.
- כל הכתיבה היחידה ב-MVP: שמירת lay­out אישי בטבלה חדשה.
- כל קריאות הדאטה הן `SELECT` בלבד, מסוננות לפי `tenant_id` הנוכחי דרך RLS קיים.
- אם המודול נופל ב-runtime — שאר המערכת ממשיכה לעבוד (Error Boundary סביב הקנבס).

### מסלול ותפריט
- Route חדש: `/t/:tenantSlug/visual-workspace`
- קישור בסיידבר תחת קבוצה חדשה "מרחב ויזואלי" עם אייקון `Sparkles` (לא דורס כלום).
- מוגן ב-`ProtectedRoute` רגיל, ללא דרישת permission ספציפי בשלב הזה.

### מבנה תיקיות
```
src/visual-workspace/
  components/
    WorkspaceCanvas.tsx       // קנבס ראשי, רקע, pan/zoom עדין
    BusinessCore.tsx          // כרטיס מרכזי
    DepartmentIsland.tsx      // כרטיס אי גנרי
    IslandPanel.tsx           // פאנל מורחב עם 6 טאבים
    AgentAvatar.tsx           // SVG עובד מעבדה + 6 סטייטים
    GlassPanel.tsx            // wrapper זכוכית משותף
    CustomerSheet.tsx         // Sheet צד עם כרטיס לקוח
    TaskSheet.tsx             // Sheet עם כרטיס משימה
    AgentSheet.tsx            // Sheet עם כרטיס אייג'נט
    SearchBar.tsx             // חיפוש גלובלי במרחב
  adapters/
    visualWorkspaceAdapter.ts // mapping CRM → visual objects
  hooks/
    useWorkspaceLayout.ts     // טעינה/שמירה של lay­out (debounced)
    useVisualWorkspaceData.ts // queries + KPI aggregation לכל אי
    useIslandStats.ts         // KPIs ספציפיים per-department
  types/
    visualWorkspaceTypes.ts
  utils/
    layoutUtils.ts            // default positions, snap, bounds
    glassTokens.ts            // semantic tokens helpers
```
לא מוסיפים תלויות חדשות. גרירה תתבסס על `@dnd-kit` שכבר בפרויקט.

### עיצוב — Glass Islands (Apple/VisionOS)
- רקע: לבן/אפור מאוד בהיר עם שכבת blur עדינה ו-grain כמעט בלתי נראה.
- כרטיסים: זכוכית (`backdrop-blur-xl`), פינות 24px, גבול 1px בעדינות, צל רך עמוק.
- צבעי דגש per-island (semantic tokens חדשים ב-`index.css`, ללא כתיבת hex בקומפוננטות):
  - Management — אינדיגו קר
  - Marketing — סגול-כחול
  - Sales — כתום חמים
  - Creative — ורוד-מנטה
  - Finance — ירוק רגוע
  - Development — תכלת טכנולוגי
  - Customer Success — טורקיז
  - System — גרפיט
  - Agents — ענבר
- אנימציות: `framer-motion` (כבר בפרויקט) — fade-in מדורג, pulse עדין ב-Core, hover lift.
- RTL מלא, עברית.

### Business Core (במרכז)
כרטיס זכוכית גדול עם פעימה עדינה. מציג מתוך `tenant` הנוכחי:
- שם העסק (מ-`tenants.name`)
- לקוחות פעילים (`clients` count לפי tenant)
- משימות פתוחות (`tasks` בסטטוס `open`/`in_progress`)
- אייג'נטים פעילים (`ai_agents` active)
- התראות חשובות (`campaign_alerts` + `report_alerts` פתוחות)
- הכנסות חודש נוכחי (`finance` / `income_payments` סכום החודש) — אם אין, מסתיר את השדה
- לקוחות בסיכון (`clients` שבהם `mood_status in ('churn_risk','not_progressing')`)
- משימות דחופות (משימות `due_date <= today` ו-`status != done`)

### 9 איים (Islands) — מה כל אי שואב
כל אי הוא DepartmentIsland זהה במבנה, נבדל ב-`config` שלו. ב-MVP: כל הקריאות `SELECT` בלבד, מסוננות tenant.

| אי | מקור דאטה (קריאה בלבד) | KPIs מוצגים על הכרטיס |
|----|---|---|
| Management | `goals`, `tasks` (status), `clients` aggregates | יעדים פתוחים · משימות ניהול · בריאות עסק |
| Marketing | `automations`, `social_publications`, `campaign_alerts`, `leads` | קמפיינים · לידים השבוע · התראות |
| Sales | `leads` לפי `lead_pipeline_stages`, `client_onboarding` | Pipeline · לידים חמים · עסקאות החודש |
| Creative | `social_gantt_posts`, `social_publications` | פוסטים מתוכננים · בריפים · משימות קריאייטיב |
| Finance | `finance`, `income_payments`, `expense_payments`, `supplier_invoices` | הכנסות · הוצאות · חייבים |
| Development | `automations`, `automation_executions`, `tenant_integrations`, `error_logs` | אוטומציות פעילות · ריצות · שגיאות |
| Customer Success | `clients` (mood/health), `client_updates`, `tasks` ב-client | לקוחות בסיכון · עדכונים · פניות |
| System | `tenant_users`, `user_roles`, `tenant_integrations`, `integration_health` | משתמשים · תפקידים · אינטגרציות |
| Agents | `ai_agents`, `agent_tasks`, `agent_runs`, `agent_action_log` | אייג'נטים · משימות פעילות · ריצות |

לכל אי יוצג בכרטיס: שם, אייקון, אייג'נט אחראי קטן (avatar), 2–3 KPIs, מספר משימות פתוחות, מספר התראות, סטטוס כללי (ירוק/צהוב/אדום נגזר מסף חכם — למשל אדום אם יש >0 alerts קריטיים).

### פתיחת אי (IslandPanel)
לחיצה ⇒ הכרטיס מתרחב בתוך הקנבס (motion expand) ל-Panel רחב עם טאבים:
- **Overview** — סיכום + 4-6 KPIs מורחבים + גרף מיני
- **Items** — רשימה של ה-entity הראשי של האי (לקוחות / לידים / קמפיינים…)
- **Tasks** — משימות שייכות (לפי module/department tag או joined entity)
- **Agents** — אייג'נטים ששייכים לאי + סטייטוס
- **Analytics** — 1-2 גרפים בסיסיים מ-Recharts (כבר בפרויקט)
- **Settings** — placeholder ב-MVP ("מתוכנן לשלב 2")

ניתן לפתוח כמה Panels במקביל. סגירה ⇒ collapse חזרה לכרטיס.

### Sheets — לקוח / משימה / אייג'נט
לחיצה על entity בתוך אי פותחת `Sheet` זכוכית מצד ימין (RTL):
- **Customer Sheet**: שם, סטטוס, איש קשר, משימות פתוחות, שיחות אחרונות (`chat_messages` last 5), קמפיינים קשורים, אייג'נטים מטפלים, הערות, אזור "סיכום AI" + "המלצות לפעולה" כ-placeholder עם תווית "בקרוב".
- **Task Sheet**: כותרת, תיאור, סטטוס, due_date, משויך ל-, לקוח קשור, היסטוריה (`task_updates`).
- **Agent Sheet**: שם, תפקיד, מודל, סטטוס נוכחי, 5 ריצות אחרונות (`agent_runs`), 5 פעולות אחרונות (`agent_action_log`), משימות פעילות.

כל ה-Sheets read-only ב-MVP. אין כפתורי שליחה/אישור/מחיקה.

### Drag & Drop + שמירת Layout
- גרירה של איים בתוך הקנבס (`@dnd-kit`).
- snap עדין ל-grid 16px.
- bounds: לא יוצא מהקנבס.
- שמירה debounced (1s) לטבלה חדשה.

**טבלה חדשה (בלבד):**
```sql
CREATE TABLE public.user_workspace_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  module_id text NOT NULL,            -- 'core' | 'marketing' | 'sales' | ...
  x_position int NOT NULL DEFAULT 0,
  y_position int NOT NULL DEFAULT 0,
  width int NOT NULL DEFAULT 320,
  height int NOT NULL DEFAULT 220,
  is_open boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, module_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_workspace_layout TO authenticated;
GRANT ALL ON public.user_workspace_layout TO service_role;

ALTER TABLE public.user_workspace_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own layout"
  ON public.user_workspace_layout
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```
ללא נגיעה בטבלה אחרת. ללא טריגר חוצה-טבלאות.

### Adapter — `visualWorkspaceAdapter`
מודול pure-functions, לא משנה דאטה:
```ts
mapClientToSatellite(client) → { id, name, status, healthColor, agentIds[], moduleIds[] }
mapTaskToOrb(task) → { id, title, status, urgency, agentId, moduleId }
mapAgentToAvatar(agent) → { id, name, role, llm, state, activeTaskCount, accessory }
mapAutomationToFlow(auto) → { id, name, status, lastRun, errorCount }
mapDepartmentKPIs(deptId, rawData) → { primary, secondary, alerts, status }
```
ה-Adapter מקבל דאטה מ-React Query hooks, מחזיר אובייקטים ויזואליים. אין בו fetch ישיר.

### אייג'נטים — Lab Workers (SVG)
קומפוננטה אחת `AgentAvatar` עם props: `role`, `state`, `size`, `accessoryOverride`.
- בסיס משותף: ראש עגול + גוף קצר + משקפי מגן — `<svg viewBox="0 0 80 100">` קל.
- אקססוריז per-role: מגפון (Marketing), טלפון (Sales), מחשבון (Finance), מקלדת (Dev), כוכב (CEO), מפתח ברגים (System), אזניות (CS), טאבלט (Creative).
- 6 סטייטים ויזואליים: idle (פעימה איטית), working (קווי טייפ קטנים), waiting (דגל קטן), error (סימן קריאה אדום), completed (V ירוק), overloaded (3 mini-clones מסביב).
- ב-MVP: ה-`state` נגזר מ-`agent_runs.status` האחרון של אותו agent_id (mapping).
- כל ה-SVG inline, ללא תלות חיצונית, ללא 3D.

### חיפוש וסינון
- שורת חיפוש עליונה גלובלית: לקוחות / משימות / אייג'נטים — fuzzy על שם.
- פילטר מהיר ב-IslandPanel (סטטוס/תאריך).

### פעולות מותרות ואסורות (MVP)
**מותר**: צפייה, פתיחת sheets, גרירה, שמירת layout אישי, חיפוש, פילטור.
**אסור (יושבת באופן קשיח בקוד)**: מחיקה, שליחת מיילים/הודעות, הפעלת אוטומציות, שינוי הרשאות, שינוי אינטגרציות, הרצת אייג'נטים. אין בכלל כפתורי-פעולה כאלה ב-UI; השלב הבא יוסיף אותם עם ConfirmationModal.

### בדיקות לפני סגירה
- [ ] כל המסכים הקיימים נטענים כרגיל (smoke test ידני: Dashboard, CRM, Chat, Automations, Tasks).
- [ ] אין שינוי בטבלאות קיימות — רק `CREATE TABLE user_workspace_layout`.
- [ ] קריסת `/visual-workspace` תפוסה ב-Error Boundary; הניווט החוצה עובד.
- [ ] שמירת layout עובדת ומשוחזרת בטעינה.
- [ ] RLS על `user_workspace_layout`: משתמש לא רואה layouts של אחרים.
- [ ] ביצועים: queries מוגבלות ב-`limit`, ללא `select *` כבדים מ-tables עם הרבה עמודות.

### שלבים הבאים (לא ב-MVP)
- שלב 2: גרירה בין איים (לקוח→אייג'נט) עם ConfirmationModal לפני כל כתיבה.
- שלב 2: יצירת/שינוי משימה מהמרחב.
- שלב 3: Toggle בין Glass Islands ל-Business Universe (יקום חי).