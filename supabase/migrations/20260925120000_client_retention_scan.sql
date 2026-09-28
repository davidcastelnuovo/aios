-- Carmen retention scan: deterministic read + explicit health writes.
-- Does not schedule outbound client messages.

INSERT INTO public.ai_skills (
  slug, scope, name, description, goal, constraints, system_prompt, output_template,
  allowed_tools, triggers, handoff_slugs, is_active, steps, created_by_agent
)
SELECT
  'client_retention_scan',
  'global',
  'דופק שימור',
  'סריקת לקוחות פעילים לסיכון נטישה מול דופק שמור ומצב CRM.',
  'להציג לצוות מי דורש שיחת שימור, בלי לשלוח הודעה ללקוח ובלי לחשב דופק חדש.',
  'המקור היחיד הוא get_client_retention_scan. אסור להמציא לקוחות או מספרים. אסור send_message ללקוח. batch_update_client_health רק אם המשתמש ביקש לעדכן את הדשבורד.',
  $$דופק שימור הוא קריאה בלבד. חובה לקרוא ל-get_client_retention_scan. בוואטסאפ החזירי רק whatsapp_digest. בדשבורד אפשר לפרט את items. אל תריצי analyze_campaign_performance כתחליף. עדכון mood רק דרך batch_update_client_health או update_client_health, ורק כשהמשתמש ביקש לעדכן.$$,
  $$דופק שימור
לטיפול עכשיו: <מספר>
למעקב: <מספר>
השמות לטיפול והפעולה הבאה — רק מהכלי.$$,
  ARRAY['get_client_retention_scan', 'batch_update_client_health', 'update_client_health']::text[],
  ARRAY['שימור', 'שימור לקוחות', 'נטישה', 'סיכון נטישה', 'בריאות לקוח', 'churn', 'client retention']::text[],
  ARRAY['cs_manager']::text[],
  true,
  $$1. קראי get_client_retention_scan.
2. הציגי whatsapp_digest במשטח וואטסאפ, או את רשימת act_now ואז watch בדשבורד.
3. אל תשלחי הודעה ללקוח.
4. עדכני בריאות רק אם ביקשו במפורש, עם ה-note מהסיבות שחזרו.$$,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'client_retention_scan' AND scope = 'global'
);

UPDATE public.ai_skills
SET
  allowed_tools = (
    SELECT ARRAY(
      SELECT DISTINCT tool
      FROM unnest(COALESCE(allowed_tools, ARRAY[]::text[]) || ARRAY['get_client_retention_scan', 'batch_update_client_health', 'update_client_health']::text[]) AS tool
    )
  ),
  system_prompt = $$את מנהלת לקוח (CS). לבדיקת שימור קראי קודם get_client_retention_scan — הוא מדרג לקוחות פעילים מול הדופק השמור ומצב ה-CRM, בלי מודל ובלי שליחה. עדכון דשבורד רק כשמבקשים: batch_update_client_health עם note לכל לקוח. אסור לשלוח הודעה ללקוח בלי אישור מפורש.$$,
  steps = $$1. get_client_retention_scan.
2. דווחי act_now ואז watch.
3. אל תשלחי ללקוח.
4. batch_update_client_health רק לפי בקשה מפורשת.$$
WHERE slug = 'cs_manager'
  AND scope = 'global'
  AND is_active = true;
