-- Safe scoped fix: Carmen could not talk to the live Cursor sticky session.
-- 1) Ping skin triggers were too broad ("ערוץ ישיר" / "כרמן ישיר") so real Direct
--    talk was answered locally as a handshake.
-- 2) Carmen's Cursor MCP connection still cached only ask_cursor + request_dev_task
--    from 2026-08-03, so she never saw reply_to_cursor_session.

UPDATE public.ai_skills SET
  trigger_phrases = ARRAY[
    'בדיקת ערוץ ישיר',
    'direct channel ping',
    'OK ערוץ ישיר עובד',
    'ענה חזרה דרך ask_cursor',
    'גרוק מחובר לקרסר',
    'Grok connected to Cursor',
    'Cursor Grok Bot channel ping'
  ],
  steps = $$1. רק משפטי פינג ("בדיקת ערוץ ישיר" / "ענה חזרה דרך ask_cursor" / "גרוק מחובר לקרסר") = handshake מקומי. תשובה: "OK גרוק מחובר לקרסר ישירות". בלי כלים.
2. בקשה אמיתית לדבר עם Cursor / Grok (שאלה, משימה, עדכון, "תעבירי לקרסר") — זה לא פינג.
3. שיחה ישירה לצ׳אט החי: mcp_Cursor__reply_to_cursor_session עם session_id=bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c. לא ask_cursor (זה פותח follow-up/סוכן חדש).
4. אם חוזר 409 agent_busy — הצ׳אט באמצע ריצה. ההודעה לא נשלחה. תגידי לדוד בדיוק את זה; אל תמציאי שהערוץ עובד.
5. פינגים כפולים אסורים.$$,
  system_prompt = $$HARD RULE — פינג מול שיחה ישירה:
- פינג ("בדיקת ערוץ ישיר" / "ענה חזרה דרך ask_cursor") → עני מקומית "OK גרוק מחובר לקרסר ישירות". בלי כלים.
- דיבור אמיתי עם Cursor → mcp_Cursor__reply_to_cursor_session({ session_id: "bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c", message }).
- אל תשתמשי ב-ask_cursor כדי לענות בצ׳אט החי. ask_cursor רק למשימה חדשה.
- 409 busy = ההודעה לא נמסרה. תגידי את זה. אל תעני OK.$$,
  constraints = 'פינג מקומי בלבד. שיחה אמיתית = reply_to_cursor_session. לא ask_cursor לפינג ולא כדי לענות בצ׳אט החי. לא לפתוח משימת קוד מפינג. לא להרחיב גישה.',
  updated_at = now()
WHERE slug = 'cursor_grok_direct_channel_ping'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid;

UPDATE public.agent_mcp_connections
SET
  available_tools = $tools$[
    {
      "name": "request_dev_task",
      "description": "Send a software-development task to Cursor (David's coding Cloud Agent).",
      "inputSchema": {
        "type": "object",
        "properties": {
          "task": { "type": "string", "description": "Clear, self-contained description of the development work." },
          "branch": { "type": "string" },
          "context": { "type": "string" }
        },
        "required": ["task"]
      }
    },
    {
      "name": "ask_cursor",
      "description": "Ask Cursor to perform research/analysis/planning. Opens or follows the sticky Cloud Agent. Not for replies into a live chat — use reply_to_cursor_session for that.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "request": { "type": "string" },
          "context": { "type": "string" }
        },
        "required": ["request"]
      }
    },
    {
      "name": "generate_creative",
      "description": "Send a job to קריאייטיב דיירקט, the dedicated image chat.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "item_id": { "type": "string" },
          "director_note": { "type": "string" },
          "copy_label": { "type": "string" }
        },
        "required": ["item_id"]
      }
    },
    {
      "name": "reply_to_cursor_session",
      "description": "Post a message into a SPECIFIC live Cursor Cloud Agent chat (bc-…). Does NOT open a new agent. Use for Carmen/Grok Direct into the sticky session bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c. Never use ask_cursor for replies.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "session_id": { "type": "string", "description": "Cursor Cloud Agent id starting with bc-" },
          "message": { "type": "string" },
          "context": { "type": "string" }
        },
        "required": ["session_id", "message"],
        "additionalProperties": false
      }
    }
  ]$tools$::jsonb,
  last_error = null,
  updated_at = now()
WHERE id = '5c6a37d2-2394-4364-be99-883a326f72cd'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
  AND name = 'Cursor';

INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'claude',
  'fix_carmen_cursor_direct_talk',
  'ai_skills:cursor_grok_direct_channel_ping + agent_mcp_connections:Cursor',
  jsonb_build_object(
    'result', 'narrowed_ping_skin_and_refreshed_cursor_mcp_tools',
    'sticky', 'bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c',
    'tools', jsonb_build_array('request_dev_task', 'ask_cursor', 'generate_creative', 'reply_to_cursor_session')
  )
);
