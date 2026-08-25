-- Carmen skin: empty personal task queue troubleshooting
INSERT INTO public.ai_skills
  (slug, scope, tenant_id, name, description, goal, constraints, system_prompt, allowed_tools, triggers, is_active, steps, created_by_agent)
SELECT
  'campaigner_mine_tasks_visibility',
  'tenant',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'משימות שלי — ריק בלוח',
  'כשקמפיינר/team_manager מדווח שלא רואה משימות ב"שלי בלבד" למרות שיש משימות פתוחות.',
  'לאבחן ולהסביר למה לוח המשימות ריק, בלי להרחיב הרשאות.',
  'אל תגידי "אין משימות" לפני list_tasks / בדיקת DB. פילטר "שלי בלבד" חוצה סוכנויות — לא לבלבל עם פילטר סוכנות בהדר.',
  $$כשמשתמש (במיוחד team_manager+קמפיינר כמו אנה) אומר "לא רואה משימות":
1. אמתי שיש משימות open/in_progress עם campaigner_id שלו (list_tasks / DB).
2. הסבירי: במסך משימות, פילטר ברירת מחדל = "שלי בלבד" — מציג משימות **משויכות** אליו across promo/DMM-MC, גם אם בהדר נבחרה סוכנות אחרת (למשל MarketingCaptain).
3. אם הוא רוצה לוח צוות לפי סוכנות — יעבור ל"כל הקמפיינרים" + יבחר סוכנות בהדר.
4. אם עדיין ריק — בדקי profiles.campaigner_id מקושר, ושהמשימות לא done.$$,
  ARRAY['list_tasks','list_clients'],
  ARRAY['לא רואה משימות','אין משימות','משימות שלי','tasks empty','my tasks','שלי בלבד'],
  true,
  $$1. list_tasks / query tasks by campaigner_id + status open/in_progress.
2. הסבירי פילטר "שלי" vs סוכנות בהדר.
3. הציעי "כל הקמפיינרים" לתצוגת צוות.$$,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills s
  WHERE s.slug = 'campaigner_mine_tasks_visibility'
    AND s.scope = 'tenant'
    AND s.tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
