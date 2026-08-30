# ערוצי מוח ישירים + פרלמנט

שכבת routing מעל Command Center. `ai_agents.engine` נשאר מזהה מודל פנימי בלבד.

## נתיב שליחה

```
Carmen UI
  -> agent-channel-send
     -> internal        -> run-ai-agent (stream)
     -> cursor / codex  -> צ'אט Cursor שכבר פתוח (bc-…). follow-up בלבד
     -> grok            -> webhook של Grok Bot הקיים
     -> claude          -> Routine /fire + callback
     -> chatgpt         -> Workspace Agent trigger + reply_to_aios_session
     -> parliament      -> Cursor+Grok+Codex, 2 rounds, סינתזה של כרמן
```

חיוב: Cursor Direct ו-Codex Direct = חשבון Cursor Cloud (לא קרדיט OpenAI, לא מנוי ChatGPT). כרמן פנימית = OpenAI API. ChatGPT Work Agent = מנוי/workspace נפרד.

בחירת ערוץ בבורר משנה בפועל את הנתיב (`agent-channel-send`), לא רק את התווית.

טאב MCP Connections נשאר לכלי האצלה. ערוצי מוח הם אזור נפרד ב-Command Center.

## טבלאות

מיגרציה `20260828200000_agent_brain_channels.sql`:

- `agent_brain_routes`
- `agent_channel_sessions` (sticky לפי שיחת AIOS + ספק)
- `ai_conversation_messages` (כתיבות מקבילות + idempotency)
- עמודות `brain_mode` / `brain_route_id` על `ai_agents`
- עמודות `agent_id` / `routing_mode` / `status` על `ai_conversations`

JSONB ב-`ai_conversations.messages` נשמר בתקופת המעבר.

## Edge functions

| Function | JWT | תפקיד |
|---|---|---|
| `agent-channel-send` | user JWT נבדק בפנים | נתב + persist |
| `agent-channel-callback` | HMAC per-session | תשובה אסינכרונית |
| `agent-channel-mcp` | `AGENT_CHANNEL_MCP_BEARER` (fallback `CURSOR_MCP_BEARER`) | `reply_to_aios_session`, `publish_aios_progress`, `request_aios_approval` |
| `run-agent-parliament` | user JWT | start/cancel parliament |

`cursor-mcp` ו-`grok-mcp` חושפים גם `reply_to_aios_session`. `cursor-mcp` חושף `reply_to_cursor_session` (follow-up ל-`bc-…` קיים).

## סודות

קיימים: `CURSOR_API_KEY`, `CURSOR_MCP_BEARER`, `GROK_MCP_BEARER`, `CLAUDE_ROUTINE_ID`, `CLAUDE_ROUTINE_TOKEN`.

פריוויו מדבר עם Staging. מושבי Cloud שם משתמשים ב-`CURSOR_API_KEY` של Staging. הסודות האלה **לא** בדאטאבייס — מעתיקים מפרוד עם `copy-edge-secrets-to-staging` (allowlist בלבד). בדיקת תקינות: `POST agent-channel-send` עם `action=channel_health`. ראו `docs/ENVIRONMENTS.md` § Development agents.

מומלץ להוסיף:

- `CURSOR_DIRECT_AGENT_ID` / `CURSOR_STICKY_AGENT_ID` — `bc-…` של הצ'אט הפתוח ל-Cursor Direct
- `CODEX_DIRECT_AGENT_ID` — `bc-…` נפרד ל-Codex (אותו חשבון Cursor, לא OpenAI)
- `AGENT_CHANNEL_CALLBACK_SECRET` — חתימת callback (fallback: `CURSOR_MCP_BEARER`)
- `AGENT_CHANNEL_MCP_BEARER` — Bearer ל-MCP של הערוץ
- `CHATGPT_WORK_AGENT_TRIGGER_ID` (`agtch_…`) + `CHATGPT_WORK_AGENT_TOKEN` — ChatGPT Direct

בלי סודות ChatGPT הערוץ נשאר בבורר ומחזיר הודעת "לא מחובר" במקום להעמיד פני מוח פנימי.

## קול

OpenAI Realtime הוא מעטפת שמע בלבד. `ask_carmen` ב-Live עובר דרך `agent-channel-send` לפי הערוץ שנבחר. כש-callback חוזר וה-session החי עדיין פתוח, התשובה מוקראת.

## פרלמנט MVP

Cursor + Grok, שני סבבים, כרמן מסכמת. כשל חלקי לא מפיל את הדיון. בזמן דיון הכלים read-only ואין פרלמנט מקונן. השיחה נעולה עד הסיכום.

כפתורים בלוח: **המשך סבב** (מדלג על מושב שותק), **סיים וסכם**, **בקש הבהרה** ממושב שנבחר, **עצור**. פעולות: `parliament_continue` / `parliament_synthesize` / `parliament_clarify` על `agent-channel-send`.

## פריסה

הפונקציות עולות עם `deploy-edge-function.yml` אחרי merge ל-`main`. המיגרציה צריכה לרוץ על פרוד לפני שה-UI כותב לטבלאות החדשות; עד אז הבורר עובד עם fallback מקומי והמוח הפנימי ממשיך ב-`run-ai-agent`.
