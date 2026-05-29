
## מאושר ✅ — מוסיף זיכרון אוטומטי גם לסוכנים האחרים

---

## מה נבנה (סדר ביצוע)

### 1. סכימה — מיגרציה אחת

**`agent_goals`** (פר-סוכן):
`id, tenant_id, agent_id → ai_agents, title, description, priority (high/medium/low), status (active/paused/done), target_date, metadata, created_at, updated_at`

**`agent_knowledge_folders`** (תיקיות, היררכיה):
`id, tenant_id, agent_id, parent_folder_id → self, name, icon, position, created_at`

**`agent_knowledge_items`** (פריטי ידע):
`id, tenant_id, agent_id, folder_id → agent_knowledge_folders, title, content (text), kind (note/document/link/snippet), url, tags[], embedding vector(1536), created_at, updated_at`

**`agent_memory`** (זיכרון פר-סוכן — אנלוגי ל-`carmen_memory_pointers`):
`id, tenant_id, agent_id, category, subcategory, path, entity_type, entity_id, title, summary, summary_embedding vector(1536), importance, ref_date, valid_until, metadata, created_at, updated_at`
+ אינדקסים: tenant+agent+path, tenant+agent+category, hnsw על summary_embedding.

**RLS** לכולן: `tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin()`.
**GRANT**: `SELECT,INSERT,UPDATE,DELETE` ל-`authenticated`, `ALL` ל-`service_role`.

### 2. זיכרון אוטומטי לכל הסוכנים

**שינוי ב-`run-ai-agent/index.ts`:**
בסוף כל ריצת סוכן (אחרי שהמודל החזיר תשובה סופית), אם `agent_id != carmen_id`:
- קוראים לפונקציה חדשה `summarizeAndStoreAgentMemory({ agent_id, tenant_id, conversation, tool_calls })`.
- היא קוראת ל-Lovable Gateway (`gemini-2.5-flash-lite` — זול) עם prompt קצר: "סכם את האינטראקציה ב-2-3 משפטים, החזר JSON: { title, summary, category, importance (1-100), entity_type?, entity_id? }".
- מחשבת embedding ל-summary דרך `google/gemini-embedding-001` (כמו `carmen-memory.ts` הקיים).
- שומרת ב-`agent_memory`.
- כל זה ב-`EdgeRuntime.waitUntil(...)` כדי לא לעכב את התשובה למשתמש.

**כרמן ממשיכה ב-`carmen_memory_pointers/episodes`** הקיימים — לא נוגעים.

**אחזור זיכרון:** ב-build-prompt של סוכן לא-כרמן, מוסיפים שליפה של 5-10 הזיכרונות הרלוונטיים ביותר (cosine similarity על embedding של ההודעה הנכנסת) ומזריקים ל-system prompt תחת הכותרת "זיכרון רלוונטי מאינטראקציות קודמות".

### 3. בורר מודלים דינמי — "המוח"

**Edge fn חדשה: `list-ai-models`**
- מנסה `GET https://ai.gateway.lovable.dev/v1/models` עם `Lovable-API-Key`.
- אם הגייטוויי תומך → מחזירה את הרשימה החיה (כולל מודלים חדשים שלוברל מוסיפים).
- Fallback: רשימה אצורה מ-`_shared/models.ts` (מקור יחיד שגם `run-ai-agent` משתמש בו).
- Cache: 1 שעה edge + 30 דקות React Query.

**`_shared/models.ts`** חדש — `MODEL_CATALOG` אחד עם: id, label, family, context_window, capabilities (text/image/vision). מחליף את ה-hardcoded ב-`resolveModel()`.

**`run-ai-agent` `resolveModel()`** — אם `agent.engine` הוא מזהה תקין מהקטלוג → משתמש כמו שהוא, בלי לתרגם. כך בחירת מודל חדש מהדרופדאון "פשוט עובדת" בלי שינוי קוד.

### 4. UI חדש — `AgentHub.tsx` רהיט מחדש

```text
┌─────────────────────────────────────────────────────────┐
│ AgentHub                                                │
├──────────────┬──────────────────────────────────────────┤
│ Sidebar      │  [Avatar] שם הסוכן          [● פעיל]    │
│              │  ┌─────────────────────────────┐         │
│ ★ כרמן       │  │ 🧠 מוח: [Gemini 3 Flash ▼] │ ← live  │
│ ───────────  │  └─────────────────────────────┘         │
│ • סוכן 1     │                                          │
│ • סוכן 2     │  [פרופיל][מטרות][כלים][ידע][זיכרון]    │
│ + סוכן חדש   │                                          │
│              │  ‹ תוכן הטאב הנבחר ›                    │
└──────────────┴──────────────────────────────────────────┘
```

**טאבים:**
| טאב | תוכן |
|---|---|
| ⚙️ פרופיל | שם, אישיות, talent, סגנון כתיבה, שפה, אורך תשובות, system_prompt |
| 🎯 מטרות | CRUD על `agent_goals` עם סינון לפי סטטוס |
| 🛠️ כלים | ALL_TOOLS עם checkboxes לפי קבוצה (קיים — מועבר לטאב) |
| 📚 ידע | עץ תיקיות (drag-drop) + פאנל פריטים. יצירת note/link/snippet |
| 🧠 זיכרון | לכרמן: `carmen_memory_pointers` + `carmen_memory_episodes`. אחר: `agent_memory`. פילטר category/path + מחיקה ידנית |

**רכיבים חדשים:**
```
src/components/agents/
  AgentSidebar.tsx
  AgentEditor.tsx          # מעטפת + Brain selector + טאבים
  BrainSelector.tsx
  tabs/{Profile,Goals,Tools,Knowledge,Memory}Tab.tsx
src/hooks/
  useAiModels.ts           # קריאה ל-list-ai-models
  useAgentGoals.ts
  useAgentKnowledge.ts
  useAgentMemory.ts
```

`AgentHub.tsx` יצומצם ל-grid דק (sidebar + editor). הדיאלוג הישן הענק נמחק.

---

## מה לא משתנה

- ❌ `carmen_memory_pointers/episodes` הקיימים — קוראים מהם בלבד בטאב זיכרון של כרמן.
- ❌ ה-tools של `run-ai-agent` (`list_goals`, וכו') — נוסיף רק חדשים בעתיד אם נחוץ; הסבב הזה מתמקד ב-UI + סכימה + זיכרון אוטומטי + בורר מודלים.
- ❌ **הקלקולטור עלויות** — לא נבנה עכשיו, הסבב הבא אחרי שזה יציב.

---

## טריגרים ידועים (יטופלו תוך כדי)
- `update-updated_at` triggers על 4 הטבלאות החדשות.
- מחיקת סוכן → CASCADE על goals/knowledge/memory (FK עם `on delete cascade`).

מתחיל בבנייה?
