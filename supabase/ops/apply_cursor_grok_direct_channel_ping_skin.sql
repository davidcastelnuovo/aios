-- Carmen skin: a Cursor↔Grok Bot channel ping is a handshake, not a coding task.
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  trigger_phrases, triggers, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'cursor_grok_direct_channel_ping',
  'פינג ערוץ ישיר Cursor / Grok Bot',
  'כשבודקים אם ערוץ Cursor↔Grok Bot / כרמן-ישיר חי, עונים OK מיד. זה handshake, לא באג ולא משימת פיתוח.',
  ARRAY[
    'ערוץ ישיר',
    'בדיקת ערוץ ישיר',
    'Cursor Grok Bot channel',
    'direct channel ping',
    'כרמן ישיר',
    'OK ערוץ ישיר עובד'
  ],
  ARRAY[
    'ערוץ ישיר Cursor',
    'פינג Grok Bot'
  ],
  $$1. אם Cursor או Grok מבקשים בדיקת ערוץ ישיר — עני מיד: "OK ערוץ ישיר עובד" + חותמת זמן.
2. אל תפתחי request_dev_task / משימת קוד חדשה בשביל פינג.
3. ההוכחה שהערוץ חי היא שההודעה הגיעה לסוכן כרמן-ישיר (bc-7eb07a1e) וחזרה.
4. סכמי לדוד במשפט אחד שזה פינג תקינות, לא באג.
5. אם באמת יש תקלה (timeout / MCP unauthorized) — אז כן תעלי ל-Cursor עם שגיאה מדויקת.$$,
  $$כשדוד או Cursor אומרים "בדיקת ערוץ ישיר Cursor↔Grok Bot":
1. זה handshake. תשובה נכונה: OK, הערוץ חי.
2. אל תמציאי באג ואל תשלחי את Cursor לחקור לידים/דופק בגלל פינג.
3. הכלים: mcp_Cursor__ask_cursor / mcp_Grok__ask_grok רק אם צריך לאשר קבלה. בלי branch חדש.$$,
  'לא לפתוח משימת קוד לפינג. לא להרחיב גישה. לא להשהות אוטומציות.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'cursor_grok_direct_channel_ping'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);

UPDATE public.cursor_dispatches
SET status = 'completed'
WHERE id = '1687d7e6-b982-4579-a3e2-1d2a7e236eaf'
  AND status = 'dispatched';

INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'claude',
  'cursor_grok_direct_channel_ping_ok',
  'cursor_dispatches:1687d7e6-b982-4579-a3e2-1d2a7e236eaf',
  jsonb_build_object(
    'agent', 'cursor-grok',
    'session_url', 'https://cursor.com/agents/bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c',
    'result', 'direct_channel_ok',
    'skin', 'cursor_grok_direct_channel_ping'
  )
);

SELECT public.claude_notify_david(
  'כרמן אישרה: ערוץ ישיר Cursor↔Grok Bot עובד (סוכן כרמן-ישיר). זה פינג תקינות, לא משימת קוד.',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  '972507677613@c.us'
);
