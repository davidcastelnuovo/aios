-- Add client-contact freshness to the deterministic campaign pulse.
-- A "call" is the structured update_type selected in the client card updates tab.

ALTER TABLE public.campaign_pulse_snapshots
  ADD COLUMN IF NOT EXISTS last_client_call_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_client_call_by text;

COMMENT ON COLUMN public.campaign_pulse_snapshots.last_client_call_at IS
  'Timestamp of the latest client_updates row whose update_type is call.';
COMMENT ON COLUMN public.campaign_pulse_snapshots.last_client_call_by IS
  'Display name or email of the user who recorded the latest client call update.';

CREATE OR REPLACE FUNCTION public.client_update_documents_phone_call(p_content text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(btrim(p_content), '') = '' THEN false
    WHEN p_content ~* '(לא|טרם|עוד לא)[[:space:]]+([^[:space:]]+[[:space:]]+){0,2}(לדבר|דיבר|שוחח)'
      OR p_content ~* 'אין[[:space:]]+מענה'
      OR p_content ~* '(הלקוח|הלקוחה)[[:space:]]+לא[[:space:]]+(ענה|ענתה)'
      THEN false
    ELSE p_content ~* '(דיברתי|דיברנו|דיברה|דיבר|שוחחתי|שוחחנו|שוחחה|שוחח).{0,40}(טלפונית|בטלפון|עם[[:space:]]+(הלקוח|הלקוחה))'
      OR p_content ~* '(טלפונית|בטלפון).{0,40}(דיברתי|דיברנו|דיברה|דיבר|שוחחתי|שוחחנו|שוחחה|שוחח)'
      OR p_content ~* '(שיחה טלפונית|שיחת טלפון).{0,30}(הלקוח|הלקוחה|לקוח|לקוחה)'
      OR p_content ~* 'בוצעה[[:space:]]+שיחה.{0,20}(הלקוח|הלקוחה|לקוח|לקוחה)'
  END;
$$;

REVOKE ALL ON FUNCTION public.client_update_documents_phone_call(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_update_documents_phone_call(text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_latest_client_call_updates(p_client_ids uuid[])
RETURNS TABLE (
  client_id uuid,
  last_client_call_at timestamptz,
  last_client_call_by text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (updates.client_id)
    updates.client_id,
    updates.created_at AS last_client_call_at,
    COALESCE(NULLIF(profiles.full_name, ''), profiles.email) AS last_client_call_by
  FROM public.client_updates AS updates
  LEFT JOIN public.profiles AS profiles ON profiles.id = updates.user_id
  WHERE updates.client_id = ANY (p_client_ids)
    AND (
      updates.update_type = 'call'
      OR (
        updates.update_type = 'weekly_update'
        AND public.client_update_documents_phone_call(updates.content)
      )
    )
  ORDER BY updates.client_id, updates.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_latest_client_call_updates(uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_client_call_updates(uuid[])
  TO service_role;

-- Mark existing qualifying weekly notes as calls so the client-card history and
-- future pulse reads use the same structured update type.
UPDATE public.client_updates
SET update_type = 'call',
    updated_at = now()
WHERE update_type = 'weekly_update'
  AND public.client_update_documents_phone_call(content);

UPDATE public.ai_skills
SET
  system_prompt = $$הציגי רק את בדיקת הדופק האחרונה שכבר חושבה ונשמרה. חובה לקרוא ל-get_latest_campaign_pulse.
הבדיקה כוללת גם את מועד השיחה הטלפונית האחרונה שתועדה בעדכוני כרטיס הלקוח (update_type=call), מי תיעד אותה, והתראה אם לא תועדה שיחה ב-14 הימים האחרונים. עדכון שבועי שמציין בחיוב שהקמפיינר דיבר/שוחח טלפונית עם הלקוח נחשב עדכון שיחה; ניסוח שלילי כמו "לא הצלחתי לדבר" אינו נחשב.
הבדיקה כוללת גם התראות קריטיות פתוחות — קמפיין שנעצר או מודעה שנדחתה — עבור לקוחות שטבלת הקמפיין שלהם פעילה.
בוואטסאפ: החזירי את whatsapp_digest מהכלי כלשונו, כולל בלוק "🔴 דורש טיפול" כשהוא קיים. אסור טבלת Markdown ואסור להוסיף משפט מסייג על מה נמצא בדשבורד.
בדשבורד הפנימי (Command Center): מותר להציג formatted_markdown.
אסור ליצור או לרענן Snapshot, להריץ ניתוח קמפיינים חלופי, או להשלים מספרים מהזיכרון. אם אין Snapshot שמור, אמרי שאין בדיקת דופק זמינה.$$,
  constraints = $$המקור היחיד לבקשת "בדיקת דופק" הוא get_latest_campaign_pulse. נתוני קשר עם הלקוח מגיעים מעדכון מסוג call או מעדכון שבועי שמסווג דטרמיניסטית כשיחה טלפונית שהתקיימה; ניסוח שלילי/ניסיון שיחה אינו נחשב. התראות קריטיות מדווחות רק כשהן משויכות ללקוח עם טבלת קמפיין פעילה. בוואטסאפ אסור לשלוח טבלאות — רק whatsapp_digest כלשונו. אין להשתמש ב-analyze_campaign_performance או check_ad_accounts_health כתחליף. אין להמציא נתונים. אין ליצור בדיקה חדשה.$$,
  steps = $$1. קראי ל-get_latest_campaign_pulse ללא מסנן, אלא אם המשתמש ציין לקוח או סוכנות.
2. בוואטסאפ — הדביקי את whatsapp_digest כלשונו, כולל בלוק ההתראות הקריטיות. אסור טבלה ואסור משפט מסייג.
3. בדשבורד הפנימי — אפשר formatted_markdown.
4. אם count=0, אמרי שאין בדיקת דופק שמורה ואל תריצי כלי נוסף.$$,
  output_template = $$בוואטסאפ — העתיקי את whatsapp_digest מהכלי בלבד (סיכום סטטוסים, בלוק "🔴 דורש טיפול" כשקיים, וקישור לדשבורד).
אסור: טבלת Markdown, רשימת לקוחות מלאה, "בדיקת דופק אחרונה — חושבה ב־…" עם פירוט, או משפט על מה נמצא בדשבורד.$$,
  updated_at = now()
WHERE slug = 'pulse_check'
  AND is_active = true;
