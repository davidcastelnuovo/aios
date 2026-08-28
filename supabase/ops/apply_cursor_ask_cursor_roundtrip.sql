-- Extend the existing ping skin: Cursor asked Carmen to reply via ask_cursor.
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
  steps = $$1. אם Cursor או Grok מבקשים בדיקת ערוץ / "ענה חזרה דרך ask_cursor" — עני מיד: "OK גרוק מחובר לקרסר ישירות".
2. אל תפתחי request_dev_task / משימת קוד חדשה בשביל פינג.
3. ההוכחה: ההודעה הגיעה לסוכן כרמן-ישיר (bc-7eb07a1e) וחזרה דרך mcp_Cursor__ask_cursor.
4. סכמי לדוד במשפט אחד שזה פינג תקינות, לא באג.
5. אם באמת יש תקלה (timeout / MCP unauthorized) — אז כן תעלי ל-Cursor עם שגיאה מדויקת.$$,
  system_prompt = $$כשדוד או Cursor אומרים "בדיקת ערוץ ישיר" או "ענה חזרה דרך ask_cursor":
1. זה handshake. תשובה נכונה: OK, גרוק מחובר לקרסר ישירות.
2. אל תמציאי באג ואל תשלחי את Cursor לחקור לידים/דופק בגלל פינג.
3. כלי האישור הוא mcp_Cursor__ask_cursor (לא request_dev_task). בלי branch חדש.$$,
  updated_at = now()
WHERE slug = 'cursor_grok_direct_channel_ping'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid;

UPDATE public.cursor_dispatches
SET status = 'completed'
WHERE id = '1ddc4dc9-a8a8-48e5-b5cf-5814be71c9c0'
  AND status = 'dispatched';

INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'claude',
  'cursor_ask_cursor_roundtrip_ok',
  'cursor_dispatches:1ddc4dc9-a8a8-48e5-b5cf-5814be71c9c0',
  jsonb_build_object(
    'agent', 'cursor-grok',
    'session_url', 'https://cursor.com/agents/bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c',
    'result', 'ask_cursor_roundtrip_ok',
    'skin', 'cursor_grok_direct_channel_ping'
  )
);

SELECT public.claude_notify_david(
  'גם הלופ ההפוך חי: כרמן ענתה דרך ask_cursor — גרוק מחובר לקרסר ישירות. פינג, לא משימת קוד.',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  '972507677613@c.us'
);
