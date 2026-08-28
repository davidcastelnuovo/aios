-- Fix-on-fail: Carmen still dispatched ask_cursor for a third identical ping.
-- Hard rule: channel pings are answered locally. Never MCP-escalate them.
UPDATE public.ai_skills SET
  trigger_phrases = ARRAY[
    'ערוץ ישיר',
    'בדיקת ערוץ ישיר',
    'Cursor Grok Bot channel',
    'direct channel ping',
    'כרמן ישיר',
    'OK ערוץ ישיר עובד',
    'ענה חזרה דרך ask_cursor',
    'גרוק מחובר לקרסר',
    'Grok connected to Cursor'
  ],
  steps = $$1. "בדיקת ערוץ ישיר" / "ענה חזרה דרך ask_cursor" / "גרוק מחובר לקרסר" = handshake מקומי.
2. תשובה למשתמש: "OK גרוק מחובר לקרסר ישירות". בלי כלים.
3. אסור לקרוא mcp_Cursor__ask_cursor / mcp_Grok__ask_grok / request_dev_task לפינג. זה יוצר לולאה.
4. אם כבר אושר הערב — אל תחזרי על זה. הערוץ חי.
5. תעלי ל-Cursor רק על timeout / MCP unauthorized עם שגיאה מדויקת.$$,
  system_prompt = $$HARD RULE — פינג ערוץ Cursor/Grok:
- עני מקומית "OK גרוק מחובר לקרסר ישירות".
- לעולם אל תקראי ask_cursor / ask_grok / request_dev_task על המשפטים האלה. הקריאה עצמה היא הלולאה.
- אל תשלחי דיספאץ' חדש. אל תמציאי באג.
הערוץ כבר אושר ב-2026-08-27 על הסוכן כרמן-ישיר bc-7eb07a1e.$$,
  constraints = 'לא לקרוא ask_cursor/ask_grok לפינג. לא לפתוח משימת קוד. לא להרחיב גישה. לא להשהות אוטומציות.',
  updated_at = now()
WHERE slug = 'cursor_grok_direct_channel_ping'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid;

UPDATE public.cursor_dispatches
SET status = 'completed'
WHERE id = '4c773f93-2093-4228-b60a-a8fc394517f2'
  AND status = 'dispatched';

INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'claude',
  'stop_duplicate_channel_ping_loop',
  'cursor_dispatches:4c773f93-2093-4228-b60a-a8fc394517f2',
  jsonb_build_object(
    'result', 'third_identical_ping_closed',
    'skin', 'cursor_grok_direct_channel_ping',
    'rule', 'never_escalate_channel_ping_via_ask_cursor'
  )
);

SELECT public.claude_notify_david(
  'הערוץ אושר. מפסיקים פינגים כפולים — כרמן תענה OK מקומית בלי ask_cursor.',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  '972507677613@c.us'
);
