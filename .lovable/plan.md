# Phase C — Hermes Agent System: Supervisor, MCP, Eval

המשך בנייה אחרי ReAct loop. שלוש יכולות מרכזיות:

## 1. Multi-Agent Supervisor (האב סוכן)

סוכן ראשי שמנתב משימות לסוכנים מומחים (Carmen, SEO Analyst, Finance Agent וכו') במקום שכל סוכן ירוץ בנפרד.

**DB:**
- `agent_supervisors` — הגדרת supervisor עם רשימת `child_agent_ids`
- `agent_runs.parent_run_id` — קישור hierarchical בין runs
- `agent_runs.delegated_to` — איזה sub-agent טיפל

**Edge function:**
- `run-agent-supervisor` — מקבל goal, בוחר sub-agent מתאים (LLM routing), קורא ל-`run-ai-agent-v2` עם הסוכן הנבחר, אוסף תוצאות, יכול לקרוא לכמה sub-agents במקביל
- Handoff tool: `delegate_to_agent(agent_id, sub_goal)` — sub-agent יכול להחזיר ל-supervisor

**UI:**
- טאב `Supervisor` ב-AgentEditor — בחירת sub-agents, routing strategy (LLM/rules)
- RunsTab מציג עץ runs hierarchical (parent → children)

## 2. MCP Server Connections

חיבור MCP servers חיצוניים כך שכלים שלהם יהיו זמינים לסוכן בזמן ריצה.

**DB:**
- `agent_mcp_connections` — `tenant_id`, `agent_id`, `name`, `url`, `transport (http/sse)`, `state (ready/authenticating/failed)`, `auth_url`, `oauth_tokens` (encrypted), `client_metadata`

**Edge functions:**
- `mcp-connect` — יוצר connection, מנסה `client.tools()`, מחזיר ready/authUrl
- `mcp-oauth-callback` — משלים OAuth flow, שומר tokens
- `mcp-disconnect` — מוחק connection ו-tokens
- `/.well-known/oauth-client` — client metadata
- שינוי ב-`run-ai-agent-v2`: לפני loop, טוען MCP connections של הסוכן, פותח clients, ממזג tools (עם namespace prefix), סוגר clients בסוף

**UI:**
- טאב `MCP Connections` ב-AgentEditor — רשימת חיבורים, כפתור Connect (פותח OAuth popup), סטטוס, רשימת tools חשופים
- שימוש ב-AI SDK MCP client (`@ai-sdk/mcp` עם `createMCPClient`)

## 3. Eval & Replay

יכולת להריץ סוכן על dataset של דוגמאות ולראות תוצאות, ולהריץ run שוב מ-checkpoint.

**DB:**
- `agent_evals` — `name`, `agent_id`, `dataset` (jsonb array of {input, expected})
- `agent_eval_runs` — `eval_id`, `run_id`, `score`, `passed`, `notes`
- שדה `agent_runs.replay_of_run_id` — מצביע על ה-run המקורי

**Edge functions:**
- `run-agent-eval` — מריץ את הסוכן על כל פריט ב-dataset, מבקש מ-LLM Judge להעריך, שומר תוצאות
- `replay-agent-run` — לוקח run קיים, יוצר חדש עם same goal, רץ שוב (ללא checkpoint reuse בגרסה ראשונה)

**UI:**
- טאב `Evals` ב-AgentEditor — יצירת eval, הוספת test cases, כפתור Run, טבלת תוצאות עם score
- ב-RunsTab כפתור `Replay` ליד כל run

## Tech Details

- Supervisor routing: `gemini-2.5-flash` (זול, מהיר)
- MCP transport ברירת מחדל: HTTP עם `redirect: "error"`
- OAuth tokens מוצפנים ב-DB דרך pgcrypto (משתמש ב-secret חדש `MCP_TOKEN_ENCRYPTION_KEY`)
- LLM Judge: `gemini-2.5-pro` עם structured output (`Output.object` עם score 0-100 + reasoning)
- כל הטבלאות החדשות עם RLS לפי `tenant_id` + GRANTs

## Files

**New:**
- migration: `agent_supervisors`, `agent_mcp_connections`, `agent_evals`, `agent_eval_runs`, columns על `agent_runs`
- `supabase/functions/run-agent-supervisor/index.ts`
- `supabase/functions/mcp-connect/index.ts`
- `supabase/functions/mcp-oauth-callback/index.ts`
- `supabase/functions/mcp-disconnect/index.ts`
- `supabase/functions/run-agent-eval/index.ts`
- `supabase/functions/replay-agent-run/index.ts`
- `src/components/agents/tabs/SupervisorTab.tsx`
- `src/components/agents/tabs/McpConnectionsTab.tsx`
- `src/components/agents/tabs/EvalsTab.tsx`

**Edit:**
- `supabase/functions/run-ai-agent-v2/index.ts` — MCP tool loading + parent_run_id support
- `src/components/agents/AgentEditor.tsx` — 3 טאבים חדשים
- `src/components/agents/tabs/RunsTab.tsx` — תצוגת עץ hierarchical + כפתור Replay

## Secret נדרש
`MCP_TOKEN_ENCRYPTION_KEY` (אבקש אחרי אישור)

## סדר ביצוע
1. Multi-Agent Supervisor (הכי משפיע על Carmen)
2. MCP Connections (פותח את הסוכן לעולם)
3. Eval & Replay (איכות + debugging)

לאשר ואתחיל ב-1?
