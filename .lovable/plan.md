## השוואה מהירה: האפיון מול מה שיש לנו היום

| שכבה באפיון | מה קיים אצלנו | פער |
|---|---|---|
| **Builder ללא קוד** (Profile, Goals, Tools, Knowledge, Memory, Tasks) | יש `AgentHub` עם 6 הטאבים האלה בדיוק | רוב המבנה קיים; חסר ניהול גרסאות + מסך בדיקה חי |
| **Channels Gateway** (WA, Telegram, Web, Mail, API) | WA (Green API), Telegram, Gmail — אבל לא דרך שער מאוחד שמנרמל הודעות ומנתב לסוכן הנכון | חסר רכיב Gateway אחד שמקבל webhook ומנתב |
| **Runtime — לולאת ReAct** | יש `run-ai-agent` + `run-agent-task` (delegate_to_background) | אין לולאת ReAct מובהקת (Perceive→Reason→Act→Observe→Persist) עם תקרת איטרציות/טוקנים/עלות פר ריצה |
| **4 שכבות זיכרון** (Working / Episodic / Semantic / User-Model) | טבלת `agent_memories` אחת + consolidate worker | חסרה הפרדה לפי `memory_type`, חסר user-model פר שולח, חסר FTS על אפיזודי |
| **Skills Engine** (יצירה אוטומטית + שיפור + שיתוף) | `active_skills TEXT[]` ב-`ai_agents` בלבד | אין טבלת skills, אין יצירה אוטו׳ אחרי הצלחה, אין ספריית תבניות ארגונית |
| **Tools / MCP Registry** | קריאות ישירות ל-edge functions (Meta, Google, וכו׳) | אין רישום אחיד של כלים, אין חיבור MCP, אין סימון `requires_approval` פר כלי |
| **Approval Gate** | קיים `agent_approval_queue` ל-GitHub agent בלבד | לא חוצה-מערכת; אין UI גנרי לאישור פעולה לפני ביצוע |
| **Sub-agents** | אין | חסר לחלוטין (קריטי למשימות >5 לקוחות) |
| **Sandbox** (E2B/Daytona/Modal) | אין | אין סביבה להרצת קוד שהסוכן כותב |
| **Model Router** | מודל קבוע פר קריאה | אין ניתוב Reason→חזק, Tag→זול |
| **Context Manager** (סיכום אוטו׳ + שליפת רק רלוונטי) | זרימת היסטוריה גולמית | חסר סיכום מתגלגל וניהול חלון |
| **Observability** (Langfuse: טוקנים/עלות/כלי) | `agent_action_log` בסיסי | אין מטריקות עלות, אין דשבורד ריצה, אין trace |
| **Vault לסודות לקוח** | טוקנים שמורים ב-`tenant_integrations` כטקסט | חסר הצפנה במנוחה ייעודית + רענון מנוהל |
| **Versioning של הגדרת סוכן** (definition vs runtime) | שינויים חיים על אותה רשומה | חסר `agent_version`, אין rollback |
| **Workspaces בתוך Tenant** | יש Tenant בלבד | אין שכבת `workspace_id` (לא קריטי בפאזה ראשונה) |

---

## תוכנית שדרוג מדורגת

### Phase A — תשתית זיכרון וכלים (שבועיים)

1. **פיצול `agent_memories` ל-4 שכבות**
   - `memory_type ENUM: working | episodic | semantic | user_model`
   - אינדקס FTS על `episodic` (תקציר שיחה + מי/מתי/מה)
   - טבלה `agent_user_profiles(agent_id, contact_phone, profile JSONB)` — פרופיל מתגלגל פר שולח
   - עדכון `carmen-memory-worker` שיכתוב לשכבה הנכונה
   - טאב Memory: סינון לפי שכבה + עריכת user-model

2. **Tool Registry + Approval Gate גנרי**
   - טבלה `agent_tools(id, name, category, requires_approval, schema JSONB, handler)`
   - הרחבת `agent_approval_queue` שיהיה רוחבי (לא רק GitHub)
   - UI: רכיב התראה גלובלי "פעולה ממתינה לאישור" + טאב Tools מציג אילו כלים דורשים אישור

3. **Audit + Cost tracking**
   - הוספת `tokens_in, tokens_out, cost_usd, duration_ms, tool_calls` ל-`agent_action_log`
   - דשבורד קטן ב-AgentHub: עלות יומית/חודשית פר סוכן

### Phase B — Runtime נכון (שבועיים)

4. **לולאת ReAct מפורשת ב-`run-ai-agent`**
   - שלבים מסומנים: Perceive → Reason → Act → Observe → Persist
   - תקרות פר ריצה: `max_iterations`, `max_tokens`, `max_cost_usd`
   - שמירת כל איטרציה כ-`agent_run_steps` לצפיות

5. **Context Manager**
   - סיכום אוטומטי של היסטוריה ישנה כשמגיעים ל-X טוקנים
   - שליפת זיכרון רלוונטי (semantic + episodic) במקום כל ההיסטוריה

6. **Model Router**
   - שדה `model_strategy` פר סוכן: `reasoning_model` (gpt-5.5/pro) + `classification_model` (flash-lite/nano)
   - הניתוב לפי סוג הצעד בלולאה

### Phase C — Skills + Sub-agents (3 שבועות)

7. **Skills Engine**
   - טבלאות `agent_skills(id, tenant_id, agent_id, name, when_to_use, steps JSONB, source: auto|manual|shared)`
   - אחרי משימה מורכבת שהצליחה → הסוכן שואל "לשמור כסקיל?" (Human-in-the-loop)
   - ספריית סקילז ארגונית — שיתוף בין סוכנים תחת אותו Tenant
   - הזרקה לקונטקסט כשרלוונטי (לפי `when_to_use` + סמנטיקה)

8. **Sub-agents**
   - הרחבת `run-agent-task` שיוכל לפצל ל-N sub-runs מקבילים (כבר יש בסיס דרך `delegate_to_background`)
   - איסוף תוצאות לסיכום אחד
   - מוגבל בהתאם ל-Memory Core שלנו (>5 לקוחות = רקע)

### Phase D — Channels & MCP & Sandbox (חודש)

9. **Channels Gateway אחיד**
   - edge function `channel-gateway` שמקבל webhooks מכל הערוצים, מנרמל ל-`AgentMessage` ומפעיל את הסוכן הנכון
   - הוספת ערוץ Web Widget (סקריפט הטמעה)

10. **MCP Client בסיסי**
    - חיבור ראשוני ל-MCP server אחד (לדוגמה: File system או GitHub MCP)
    - רישום ב-Tool Registry כסוג `mcp`

11. **Sandbox** — חיבור E2B להרצת קוד שכרמן כותבת (אופציונלי, רק אם נצטרך יצירת דוחות/סקריפטים)

12. **Versioning** — `agent_versions(agent_id, version, definition JSONB, published_at)` + כפתור "פרסם גרסה" / "חזור לגרסה קודמת"

---

## מה במכוון משאירים מחוץ ל-V1
- Workspaces בתוך Tenant (לא קריטי, ה-tenant מספק בידוד)
- White-label פורטל סוכנויות (Phase 3 באפיון)
- Vault הצפנה במנוחה — נשאר על `tenant_integrations` הקיים בינתיים

---

## פרטים טכניים (ל-DB)

```text
agent_memories   → + memory_type, + ts_vector על content
agent_user_profiles (חדש)
agent_tools (חדש)            agent_skills (חדש)
agent_run_steps (חדש)        agent_versions (חדש)
agent_approval_queue        ← הופך גנרי (tool_name + payload)
agent_action_log            ← + tokens/cost/duration
```

האם להתחיל מ-Phase A, או שיש פאזה אחרת שעדיפה לך עכשיו?
