-- Add client-contact freshness to the deterministic campaign pulse.
-- A "call" is the structured update_type selected in the client card updates tab.

ALTER TABLE public.campaign_pulse_snapshots
  ADD COLUMN IF NOT EXISTS last_client_call_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_client_call_by text;

COMMENT ON COLUMN public.campaign_pulse_snapshots.last_client_call_at IS
  'Timestamp of the latest client_updates row whose update_type is call.';
COMMENT ON COLUMN public.campaign_pulse_snapshots.last_client_call_by IS
  'Display name or email of the user who recorded the latest client call update.';

UPDATE public.ai_skills
SET
  system_prompt = $$הציגי רק את בדיקת הדופק האחרונה שכבר חושבה ונשמרה. חובה לקרוא ל-get_latest_campaign_pulse.
הבדיקה כוללת גם את מועד השיחה הטלפונית האחרונה שתועדה בעדכוני כרטיס הלקוח (update_type=call), מי תיעד אותה, והתראה אם לא תועדה שיחה ב-14 הימים האחרונים.
בוואטסאפ: החזירי רק את whatsapp_digest מהכלי (סיכום סטטוסים + קישור לדשבורד). אסור טבלת Markdown, אסור פירוט לקוח-לקוח.
בדשבורד הפנימי (Command Center): מותר להציג formatted_markdown.
אסור ליצור או לרענן Snapshot, להריץ ניתוח קמפיינים חלופי, או להשלים מספרים מהזיכרון. אם אין Snapshot שמור, אמרי שאין בדיקת דופק זמינה.$$,
  constraints = $$המקור היחיד לבקשת "בדיקת דופק" הוא get_latest_campaign_pulse. נתוני קשר עם הלקוח מגיעים רק מעדכוני כרטיס לקוח מסוג call; אין להסיק שיחה מטקסט חופשי. בוואטסאפ אסור לשלוח טבלאות או פירוט לקוחות — רק whatsapp_digest. אין להשתמש ב-analyze_campaign_performance או check_ad_accounts_health כתחליף. אין להמציא נתונים. אין ליצור בדיקה חדשה.$$,
  updated_at = now()
WHERE slug = 'pulse_check'
  AND is_active = true;
