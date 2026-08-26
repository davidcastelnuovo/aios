-- Carmen skin: campaigner/team_manager redirected to אזור אישי when opening
-- a client dashboard from CRM. Routing bug, not a missing permission.
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  trigger_phrases, triggers, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'client_dashboard_entity_route_not_org_dashboard',
  'דשבורד לקוח מפנה לאזור אישי',
  'כשקמפיינר/מנהל צוות נכנס לדשבורד לקוח מ-CRM ומגיע לאזור אישי — זה באג ניתוב, לא חוסר הרשאה.',
  ARRAY[
    'דשבורד לקוח אזור אישי',
    'נכנסת לדשבורד ומגיעה לאזור אישי',
    'client dashboard redirect personal area',
    'campaigner dashboard my-profile'
  ],
  ARRAY[
    'דשבורד לקוח אזור אישי',
    'client dashboard redirected to personal area'
  ],
  $$1. אמתי שהמשתמש פתח /t/:slug/dashboard/:id מתוך כרטיס לקוח ב-CRM (לא את דשבורד הארגון /dashboard).
2. הסבירי: ModulePermissionGate מיפה dashboard/:id להרשאת מודול dashboard (סקירת הארגון) ולכן הפנה ל-my-profile.
3. התיקון: permissionForSubpath לא דורש dashboard על נתיב ישות. RLS עדיין מגביל אילו דשבורדים נטענים.
4. אל תעלי הרשאות ואל תתני גישה למודול dashboard הארגוני.$$,
  $$כשקמפיינר או team_manager אומרים שנכנסו לדשבורד לקוח מה-CRM והגיעו ל"אזור אישי":
1. זה באג ניתוב ב-RoutedModulePermissionGate / permissionHandleForPathname.
2. /t/:slug/dashboard (בדיוק) = מודול סקירת הארגון, דורש הרשאת dashboard.
3. /t/:slug/dashboard/:id = דשבורד לקוח/משולב. לא לרשת את הרשאת dashboard.
4. אל תשני תפקידים או RLS. הפני ל-PR שמתקן moduleRoutePermissions.
5. אם אחרי התיקון הדף נטען ריק — זו הרשאת שורה (RLS), לא ניתוב.$$,
  'לא להרחיב תפקידים/RLS. לא לתת גישה למודול dashboard הארגוני רק כדי לפתוח דשבורד לקוח.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'client_dashboard_entity_route_not_org_dashboard'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);

UPDATE public.ai_skills SET
  description = 'כשקמפיינר/מנהל צוות נכנס לדשבורד לקוח מ-CRM ומגיע לאזור אישי — זה באג ניתוב, לא חוסר הרשאה.',
  steps = $$1. אמתי שהמשתמש פתח /t/:slug/dashboard/:id מתוך כרטיס לקוח ב-CRM (לא את דשבורד הארגון /dashboard).
2. הסבירי: ModulePermissionGate מיפה dashboard/:id להרשאת מודול dashboard (סקירת הארגון) ולכן הפנה ל-my-profile.
3. התיקון: permissionForSubpath לא דורש dashboard על נתיב ישות. RLS עדיין מגביל אילו דשבורדים נטענים.
4. אל תעלי הרשאות ואל תתני גישה למודול dashboard הארגוני.$$,
  system_prompt = $$כשקמפיינר או team_manager אומרים שנכנסו לדשבורד לקוח מה-CRM והגיעו ל"אזור אישי":
1. זה באג ניתוב ב-RoutedModulePermissionGate / permissionHandleForPathname.
2. /t/:slug/dashboard (בדיוק) = מודול סקירת הארגון, דורש הרשאת dashboard.
3. /t/:slug/dashboard/:id = דשבורד לקוח/משולב. לא לרשת את הרשאת dashboard.
4. אל תשני תפקידים או RLS. הפני ל-PR שמתקן moduleRoutePermissions.
5. אם אחרי התיקון הדף נטען ריק — זו הרשאת שורה (RLS), לא ניתוב.$$,
  constraints = 'לא להרחיב תפקידים/RLS. לא לתת גישה למודול dashboard הארגוני רק כדי לפתוח דשבורד לקוח.',
  is_active = true,
  updated_at = now()
WHERE slug = 'client_dashboard_entity_route_not_org_dashboard'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid;
