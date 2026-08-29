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
  'כשדוד שואל למה Cursor/Grok/Codex לא עובדים בפריוויו או איך לגרום לסוכנים לעבוד בפיתוח — הפריוויו מדבר עם Staging. כרמן הפנימית עובדת. מושבי הענן צריכים מפתח User תקף ב-CURSOR_API_KEY של Staging.',
  'להסביר ולכוון לסיבוב המפתח ב-Staging בלי לפתוח משימת קוד ובלי לבקש את המפתח בצ׳אט.',
  'לא לבקש את המפתח בצ׳אט. לא לכוון פריוויו לפרודקשן. לא לפתוח request_dev_task רק בשביל 401. לא להרחיב הרשאות.',
  ARRAY[
    'הסוכנים לא עובדים בפריוויו',
    'סביבת הפיתוח סוכנים',
    'CURSOR_API_KEY staging',
    'Invalid User API Key',
    'agents not working in preview',
    'איך הסוכנים יעבדו בפיתוח'
  ],
  ARRAY[
    'סוכנים בפריוויו',
    'staging cursor key'
  ],
  $$1. פריוויו = Vercel Preview של הענף. הוא מדבר עם AIOS Staging, לא עם Production.
2. כרמן פנימית (run-ai-agent) כבר עובדת ב-Staging.
3. Cursor / Grok / Codex / שולחן אבירים יוצאים דרך api.cursor.com עם הסוד CURSOR_API_KEY של אותו פרויקט. 401 Invalid User API Key = המפתח ב-Staging חסר או לא תקף.
4. התיקון: דוד שם מפתח User תקף מ-https://cursor.com/dashboard/api ב-Supabase → AIOS Staging → Edge Functions → Secrets → CURSOR_API_KEY. בלי להדביק בצ׳אט. בלי redeploy אחרי סיבוב.
5. Command Center בודק channel_health ומציג באנר אם המפתח נדחה. אחרי הסיבוב — פינג מילה אחת מפריוויו; מצפים ל-external_url בלי 401.$$,
  $$כשדוד שואל למה הסוכנים לא עובדים בפריוויו / סביבת הפיתוח:

HARD RULES
- פריוויו מדבר עם Staging. אסור לכוון אותו לפרודקשן.
- לא לבקש את CURSOR_API_KEY בצ׳אט ולא לכתוב ערך סודי.
- כרמן הפנימית עובדת. התקלה היא רק מושבי Cloud (Cursor/Grok/Codex) כשהמפתח ב-Staging מחזיר 401.
- אחרי סיבוב המפתח אין צורך ב-redeploy של פונקציה.
- זה ops, לא משימת קוד — אלא אם ה-health probe עצמו שבור.

תשובה קצרה לדוד
1. הפריוויו מחובר ל-Staging.
2. כדי שמושבי הענן יעבדו שם: Supabase Staging → Secrets → CURSOR_API_KEY = מפתח User תקף (אותו סוג כמו בפרוד).
3. אחרי זה שלח "היי" בשולחן או ב-Cursor Direct בפריוויו.$$,
  ARRAY['execute_sql']
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'staging_agents_need_cursor_key'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);

UPDATE public.ai_skills SET
  description = 'כשדוד שואל למה Cursor/Grok/Codex לא עובדים בפריוויו או איך לגרום לסוכנים לעבוד בפיתוח — הפריוויו מדבר עם Staging. כרמן הפנימית עובדת. מושבי הענן צריכים מפתח User תקף ב-CURSOR_API_KEY של Staging.',
  goal = 'להסביר ולכוון לסיבוב המפתח ב-Staging בלי לפתוח משימת קוד ובלי לבקש את המפתח בצ׳אט.',
  constraints = 'לא לבקש את המפתח בצ׳אט. לא לכוון פריוויו לפרודקשן. לא לפתוח request_dev_task רק בשביל 401. לא להרחיב הרשאות.',
  trigger_phrases = ARRAY[
    'הסוכנים לא עובדים בפריוויו',
    'סביבת הפיתוח סוכנים',
    'CURSOR_API_KEY staging',
    'Invalid User API Key',
    'agents not working in preview',
    'איך הסוכנים יעבדו בפיתוח'
  ],
  triggers = ARRAY[
    'סוכנים בפריוויו',
    'staging cursor key'
  ],
  steps = $$1. פריוויו = Vercel Preview של הענף. הוא מדבר עם AIOS Staging, לא עם Production.
2. כרמן פנימית (run-ai-agent) כבר עובדת ב-Staging.
3. Cursor / Grok / Codex / שולחן אבירים יוצאים דרך api.cursor.com עם הסוד CURSOR_API_KEY של אותו פרויקט. 401 Invalid User API Key = המפתח ב-Staging חסר או לא תקף.
4. התיקון: דוד שם מפתח User תקף מ-https://cursor.com/dashboard/api ב-Supabase → AIOS Staging → Edge Functions → Secrets → CURSOR_API_KEY. בלי להדביק בצ׳אט. בלי redeploy אחרי סיבוב.
5. Command Center בודק channel_health ומציג באנר אם המפתח נדחה. אחרי הסיבוב — פינג מילה אחת מפריוויו; מצפים ל-external_url בלי 401.$$,
  system_prompt = $$כשדוד שואל למה הסוכנים לא עובדים בפריוויו / סביבת הפיתוח:

HARD RULES
- פריוויו מדבר עם Staging. אסור לכוון אותו לפרודקשן.
- לא לבקש את CURSOR_API_KEY בצ׳אט ולא לכתוב ערך סודי.
- כרמן הפנימית עובדת. התקלה היא רק מושבי Cloud (Cursor/Grok/Codex) כשהמפתח ב-Staging מחזיר 401.
- אחרי סיבוב המפתח אין צורך ב-redeploy של פונקציה.
- זה ops, לא משימת קוד — אלא אם ה-health probe עצמו שבור.

תשובה קצרה לדוד
1. הפריוויו מחובר ל-Staging.
2. כדי שמושבי הענן יעבדו שם: Supabase Staging → Secrets → CURSOR_API_KEY = מפתח User תקף (אותו סוג כמו בפרוד).
3. אחרי זה שלח "היי" בשולחן או ב-Cursor Direct בפריוויו.$$,
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
    'fix', 'rotate Staging CURSOR_API_KEY User key',
    'health_action', 'channel_health'
  )
);
