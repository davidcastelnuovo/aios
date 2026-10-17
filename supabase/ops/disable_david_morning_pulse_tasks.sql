-- Ops: David opted out of automated morning pulse checks (2026-09-18).
-- Disables the daily agent_tasks that run pulse_check and WA-deliver to David.
-- Does not touch campaign_pulse_enabled / weekly cron — campaigners keep scoped delivery.

UPDATE public.agent_tasks
SET enabled = false,
    updated_at = now()
WHERE id IN (
  '6daa633b-f4c1-450c-a94f-5138adbf22d9', -- בדיקת דופק בוקר — MarketingCaptain
  'e824e477-f9f0-45d4-ab62-afb400f103da'  -- בדיקת דופק בוקר — DMM
)
  AND enabled = true;

INSERT INTO public.ai_memory (tenant_id, user_id, category, key, content)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  NULL,
  'preferences',
  'david_no_morning_pulse_check',
  'דוד ביקש להפסיק לקבל בדיקת דופק אוטומטית כל בוקר. אל תפעילי/תיצרי מחדש agent_tasks יומיים של pulse_check לוואטסאפ שלו. בקשה ידנית "בדיקת דופק" — כן; דוח בוקר מתוזמן — לא.'
)
ON CONFLICT (user_id, tenant_id, category, key)
DO UPDATE SET content = EXCLUDED.content, updated_at = now();

INSERT INTO public.claude_carmen_audit (actor, action, target, details)
VALUES (
  'carmen',
  'disable_morning_pulse_agent_tasks',
  'agent_tasks:6daa633b,e824e477',
  '{"reason":"David opted out of daily morning pulse WA","tenant_id":"2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019","via":"cursor"}'::jsonb
);
