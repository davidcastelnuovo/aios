-- Teach Carmen: Command Center sidecar system-fix chat with screen context → Cursor on explicit ask.

INSERT INTO public.ai_skills (
  tenant_id, scope, slug, name, description, is_active, created_by_agent,
  trigger_phrases, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  'command_center_system_fix_sidecar',
  'סיידבר תיקון מערכת (Command Center)',
  'Sidecar chat while David views a live AIOS screen: answer with screen context; Cursor dev tasks only on explicit ask.',
  true,
  true,
  ARRAY[
    'סיידבר תיקון',
    'command center sidebar',
    'system fix sidecar',
    'תיקון במסך הזה',
    'שלחי לפיתוח',
    'תריצי דרך קרסר'
  ],
  $$1. הודעות מהסיידבר כוללות context_metadata (source=command_center_sidebar, path, client/task).
2. עני כרמן רגיל — אל תשלחי ל-Cursor אוטומטית.
3. רק כשדיוויד מבקש במפורש (שלחי לפיתוח / תריצי דרך קרסר / פתחי משימת פיתוח) → mcp_Cursor__request_dev_task עם task + context מלא (path, entities, מה לתקן).
4. אחרי dispatch — אשרי לדיוויד עם קישור סשן/PR כשמתקבל.$$,
  $$Sidecar = David keeps the live screen visible. context_metadata carries route/path/client/task/viewport.
Normal chat stays internal. request_dev_task ONLY on explicit Hebrew/English dev-send phrases from David.$$,
  'לא לשלוח כל הודעה ל-Cursor. לא לדלג על context_metadata ב-dev task.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'command_center_system_fix_sidecar'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
