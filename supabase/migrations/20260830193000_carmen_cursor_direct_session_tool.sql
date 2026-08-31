-- Carmen Cursor Direct: expose fixed session id via get_cursor_direct_session (no hardcoded bc-…).
-- Ops: set CURSOR_DIRECT_AGENT_ID=bc-… on prod + staging edge secrets (copy-edge-secrets allowlist).

UPDATE public.ai_skills SET
  trigger_phrases = ARRAY[
    'בדיקת ערוץ ישיר',
    'בדיקת חיבור מפריוויו',
    'בדיקת חיבור לקרסר',
    'direct channel ping',
    'תעבירי לקרסר: בדיקת חיבור',
    'OK ערוץ ישיר עובד',
    'גרוק מחובר לקרסר',
    'Grok connected to Cursor',
    'Cursor Grok Bot channel ping'
  ],
  steps = $$1. פינג מקומי בלבד ("בדיקת ערוץ ישיר" ללא העברה לקרסר) = handshake מקומי. בלי כלים.
2. בדיקת חיבור אמיתית / "תעבירי לקרסר" = mcp_Cursor__get_cursor_direct_session (read-only) ואז mcp_Cursor__reply_to_cursor_session עם message בלבד. לא ask_cursor ולא request_dev_task — אלה פותחים Background Agent חדש ועלולים לפגוע בקרדיט.
3. אם get_cursor_direct_session נכשל — אין צ׳אט קבוע מוגדר. תגידי לדוד להגדיר CURSOR_DIRECT_AGENT_ID או cursor_sticky_agents. אל תיפלי ל-ask_cursor.
4. אם reply_to_cursor_session מחזיר BUSY (409) — ההודעה לא נשלחה. תגידי לדוד בדיוק.$$,
  system_prompt = $$HARD RULE — פינג מול בדיקת חיבור:
- פינג מקומי בלבד → עני מקומית. בלי כלים.
- בדיקת חיבור / דיבור עם הצ׳אט הקבוע של Cursor Direct:
  1) mcp_Cursor__get_cursor_direct_session()
  2) mcp_Cursor__reply_to_cursor_session({ message: "…" })  // session_id אופציונלי
- אסור ask_cursor / request_dev_task לבדיקות חיבור או לענות בצ׳אט החי.
- שגיאה מפורשת מ-get_cursor_direct_session = אין הגדרה — לא fallback.$$,
  constraints = 'בדיקות חיבור = get_cursor_direct_session + reply_to_cursor_session בלבד. לא Background Agent חדש. לא להרחיב גישה.',
  updated_at = now()
WHERE slug = 'cursor_grok_direct_channel_ping'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid;

UPDATE public.agent_mcp_connections
SET
  available_tools = available_tools,
  last_error = null,
  updated_at = now()
WHERE id = '5c6a37d2-2394-4364-be99-883a326f72cd'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
  AND name = 'Cursor';

-- Note: available_tools is refreshed live by mcp-connect tools/list; deploy cursor-mcp 1.3.2+.
