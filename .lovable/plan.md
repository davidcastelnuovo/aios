# המשך Phase A — אישורים גנריים + שכבות זיכרון

## #2 — טאב "אישורים" גנרי + התראה גלובלית

### רכיבים חדשים
1. **`src/components/agents/tabs/ApprovalsTab.tsx`**
   - Query על `agent_approval_queue` עם `agent_id` + `status='pending'` + `expires_at > now()`
   - כרטיסים פר בקשה: `tool_name`, `tool_input` (JSON viewer), `run_id`, זמן יצירה, TTL
   - כפתורי **אשר / דחה** → UPDATE ל-`status` (`approved`/`rejected`) + `decided_at` + `decided_by=auth.uid()`
   - אחרי אישור — קריאה ל-edge function `resume-agent-run` (חדש, ראה למטה) עם `run_id`
   - מצב ריק: "אין בקשות ממתינות"
   - טאב נוסף "היסטוריה" — אישורים אחרונים (approved/rejected/expired) ב-30 יום

2. **`src/components/agents/GlobalApprovalsBell.tsx`**
   - איקון פעמון ב-`AppHeader` (ליד הפעמון הקיים אם יש, אחרת חדש)
   - Query גלובלי על כל ה-pending approvals של ה-tenant
   - Realtime subscription על `agent_approval_queue` (INSERT/UPDATE)
   - Badge אדום עם מספר; קליק פותח Popover עם רשימה מקוצרת + לינק לסוכן הרלוונטי (`/agents/:agentId?tab=approvals`)

3. **`supabase/functions/resume-agent-run/index.ts`**
   - מקבל `{ approval_id, decision }`
   - אם approved — מבצע את ה-tool שב-`tool_input` ומחזיר את התוצאה ל-`agent_runs` (מעדכן `status`/`output`)
   - אם rejected — מסמן את ה-run כ-`cancelled`
   - מתועד ב-`agent_action_log`

### עדכונים
- **`AgentEditor.tsx`** — להוסיף `<TabsContent value="approvals">` עם `ApprovalsTab`
- **`AppHeader.tsx`** (או הלייאאוט) — להציג `GlobalApprovalsBell` למשתמשים עם הרשאה

---

## #3 — סינון שכבות זיכרון + עריכת user-model

### עדכונים ל-`MemoryTab.tsx` (קיים)
1. **טאבי-משנה / סלקטור** עליון: `working` | `episodic` | `semantic` | `user_model` | `הכל`
2. **חיפוש FTS** — שדה חיפוש שמשתמש ב-`agent_memory.fts` (טריגר כבר קיים מ-Phase A)
3. **סינון לפי `contact_phone`** — דרופדאון אנשי קשר (מ-`leads`/`clients`)
4. כל פריט זיכרון מציג: `memory_type` (Badge צבעוני), `content`, `contact_phone`, `created_at`

### רכיב חדש: `src/components/agents/UserModelEditor.tsx`
- בטאב נפרד "פרופילי משתמשים" בתוך AgentEditor
- רשימת `agent_user_profiles` פר `contact_phone`
- עריכה inline: `traits` (JSON), `preferences` (JSON), `communication_style`, `notes`
- כפתור "צור פרופיל חדש" — בוחר contact מ-CRM, פותח דיאלוג

### עדכונים ל-`AgentEditor.tsx`
- טאב חדש: `<TabsContent value="user-profiles">`

---

## פרטים טכניים

### קבצים שייווצרו
- `src/components/agents/tabs/ApprovalsTab.tsx`
- `src/components/agents/tabs/UserProfilesTab.tsx`
- `src/components/agents/GlobalApprovalsBell.tsx`
- `supabase/functions/resume-agent-run/index.ts`

### קבצים שיעודכנו
- `src/components/agents/AgentEditor.tsx` — 2 טאבים חדשים
- `src/components/agents/tabs/MemoryTab.tsx` — סלקטור + FTS + סינון contact
- `src/components/layout/AppHeader.tsx` (או הקובץ הרלוונטי) — Bell

### Realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_approval_queue;
```
(מיגרציה קטנה במידת הצורך)

### עיצוב
- Badge צבעוני פר `memory_type`: working=blue, episodic=green, semantic=purple, user_model=amber
- Approvals: pending=yellow border, approved=green, rejected=red

---

## מה לא נכלל (יישאר ל-Phase B)
- ReAct loop אמיתי בתוך `run-ai-agent` שמייצר `agent_runs` + מחייב approval לפני tool execution (התשתית מוכנה, ההפעלה בשלב הבא)
- Tool registry UI לעריכת `agent_tools.requires_approval`
- שיפור עצמי / לולאות לימוד — Phase C

מאשר?