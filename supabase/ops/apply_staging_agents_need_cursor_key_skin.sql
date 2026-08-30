-- Carmen skin: Preview/Staging Cloud seats need a valid Staging CURSOR_API_KEY.
-- Preview talks to Staging. Do not point Preview at Production. Never paste the key in chat.

INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  goal, constraints, trigger_phrases, triggers, steps, system_prompt, allowed_tools
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'staging_agents_need_cursor_key',
  'סוכנים בסביבת הפיתוח',
  'כשדוד שואל למה הסוכנים לא עובדים בפריוויו או למה צריך להכניס מפתחות שוב — הפריוויו מדבר עם Staging. כרמן מהדאטאבייס. מושבי הענן מסודות Edge. מעתיקים מפרוד עם copy-edge-secrets-to-staging, בלי לבקש מדוד להדביק.',
  'להעתיק את allowlist הסוכנים מפרוד ל-Staging בלי לבקש מפתחות ובלי לכוון פריוויו לפרודקשן.',
  'לא לבקש את המפתח בצ׳אט. לא להעתיק WhatsApp/Meta. לא לכוון פריוויו לפרודקשן. לא לפתוח request_dev_task רק בשביל 401.',
  ARRAY[
    'הסוכנים לא עובדים בפריוויו',
    'סביבת הפיתוח סוכנים',
    'CURSOR_API_KEY staging',
    'Invalid User API Key',
    'agents not working in preview',
    'איך הסוכנים יעבדו בפיתוח',
    'למה אני צריך להכניס שוב מפתחות',
    'תעביר לסטייג׳ינג'
  ],
  ARRAY[
    'סוכנים בפריוויו',
    'staging cursor key',
    'העתקת מפתחות ל-staging'
  ],
  $$1. פריוויו = Vercel Preview. מדבר עם Staging, לא Production.
2. כרמן פנימית עובדת כי tenant_integrations בדאטאבייס. סודות Edge (CURSOR_API_KEY) לא בדאטאבייס — ה-API מחזיר רק hash.
3. תיקון: copy-edge-secrets-to-staging על Production, allowlist סוכנים בלבד. בלי WhatsApp/Meta. בלי לבקש מדוד להדביק.
4. אחרי ההעתקה hashes צריכים להתאים. בלי redeploy. channel_health / פינג "היי" בפריוויו.$$,
  $$כשדוד שואל למה צריך להכניס מפתחות שוב / למה הסוכנים לא עובדים בפריוויו:

HARD RULES
- לא לבקש מפתחות בצ׳אט. להעתיק מפרוד עם copy-edge-secrets-to-staging.
- לא להעתיק WhatsApp/Meta. לא לכוון פריוויו לפרודקשן.
- הדאטאבייס מכסה כרמן/OpenAI. מושבי Cloud = סודות Edge.

תשובה קצרה
הדאטאבייס לא מחזיק את CURSOR_API_KEY. העתקתי את allowlist הסוכנים מפרוד ל-Staging. שלח היי בשולחן בפריוויו.$$,
  ARRAY['execute_sql']
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'staging_agents_need_cursor_key'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);

UPDATE public.ai_skills SET
  description = 'כשדוד שואל למה הסוכנים לא עובדים בפריוויו או למה צריך להכניס מפתחות שוב — הפריוויו מדבר עם Staging. כרמן מהדאטאבייס. מושבי הענן מסודות Edge. מעתיקים מפרוד עם copy-edge-secrets-to-staging, בלי לבקש מדוד להדביק.',
  goal = 'להעתיק את allowlist הסוכנים מפרוד ל-Staging בלי לבקש מפתחות ובלי לכוון פריוויו לפרודקשן.',
  constraints = 'לא לבקש את המפתח בצ׳אט. לא להעתיק WhatsApp/Meta. לא לכוון פריוויו לפרודקשן. לא לפתוח request_dev_task רק בשביל 401.',
  trigger_phrases = ARRAY[
    'הסוכנים לא עובדים בפריוויו',
    'סביבת הפיתוח סוכנים',
    'CURSOR_API_KEY staging',
    'Invalid User API Key',
    'agents not working in preview',
    'איך הסוכנים יעבדו בפיתוח',
    'למה אני צריך להכניס שוב מפתחות',
    'תעביר לסטייג׳ינג'
  ],
  triggers = ARRAY[
    'סוכנים בפריוויו',
    'staging cursor key',
    'העתקת מפתחות ל-staging'
  ],
  steps = $$1. פריוויו = Vercel Preview. מדבר עם Staging, לא Production.
2. כרמן פנימית עובדת כי tenant_integrations בדאטאבייס. סודות Edge (CURSOR_API_KEY) לא בדאטאבייס — ה-API מחזיר רק hash.
3. תיקון: copy-edge-secrets-to-staging על Production, allowlist סוכנים בלבד. בלי WhatsApp/Meta. בלי לבקש מדוד להדביק.
4. אחרי ההעתקה hashes צריכים להתאים. בלי redeploy. channel_health / פינג "היי" בפריוויו.$$,
  system_prompt = $$כשדוד שואל למה צריך להכניס מפתחות שוב / למה הסוכנים לא עובדים בפריוויו:

HARD RULES
- לא לבקש מפתחות בצ׳אט. להעתיק מפרוד עם copy-edge-secrets-to-staging.
- לא להעתיק WhatsApp/Meta. לא לכוון פריוויו לפרודקשן.
- הדאטאבייס מכסה כרמן/OpenAI. מושבי Cloud = סודות Edge.

תשובה קצרה
הדאטאבייס לא מחזיק את CURSOR_API_KEY. העתקתי את allowlist הסוכנים מפרוד ל-Staging. שלח היי בשולחן בפריוויו.$$,
  allowed_tools = ARRAY['execute_sql'],
  is_active = true
WHERE slug = 'staging_agents_need_cursor_key'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid;

INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'claude',
  'staging_agents_need_cursor_key',
  'ai_skills:staging_agents_need_cursor_key',
  jsonb_build_object(
    'agent', 'cursor',
    'preview_talks_to', 'staging',
    'fix', 'copy-edge-secrets-to-staging allowlist',
    'health_action', 'channel_health'
  )
);
