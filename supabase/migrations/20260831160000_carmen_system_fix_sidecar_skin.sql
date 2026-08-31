-- Teach Carmen: Command Center system-fix sidecar → classify → Cursor dev task.

INSERT INTO public.ai_skills (
  tenant_id, scope, slug, name, description, is_active, created_by_agent,
  trigger_phrases, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  'command_center_system_fix_sidecar',
  'Sidecar תיקון מערכת → Cursor',
  'When David uses the in-app system-fix sidecar (command_center_sidebar), classify dev/system fixes and route to Cursor via request_dev_task when appropriate.',
  true,
  true,
  ARRAY[
    'שלחי לקרסר',
    'תריצי דרך קרסר',
    'שלחי לפיתוח',
    'תיקון מערכת',
    'sidecar',
    'command center sidebar',
    'system fix sidecar'
  ],
  $$1. זהה source=command_center_sidebar / system_fix_context + context_metadata (pathname, client_id, task_id).
2. סיווג: באג/שינוי UI/לוגיקה/הרשאות/אינטגרציה = פיתוח; שאלה תפעולית = ענה/כלים רגילים.
3. שליחה ל-Cursor רק אם: (א) דוד מורשה dev escalation, ו-(ב) בקשת פיתוח/תיקון מערכת או ניסוח מפורש "שלחי לקרסר"/"תריצי דרך קרסר"/"שלחי לפיתוח".
4. request_dev_task: task = תיאור + context_metadata + צילום מסך מילולי; אל תשלחי כל הודעה אוטומטית.
5. אחרי dispatch — עדכון קצר לדוד + קישור PR/preview כשחוזר.$$,
  $$Sidecar messages carry context_metadata from the visible AIOS screen.
Do not auto-dispatch every message to Cursor.
Explicit Hebrew dev-routing phrases or a classified system-fix request → mcp_Cursor__request_dev_task (authorized users only).$$,
  'לא לשלוח ל-Cursor בלי סיווג או ניסוח מפורש. לא להרחיב הרשאות.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'command_center_system_fix_sidecar'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
