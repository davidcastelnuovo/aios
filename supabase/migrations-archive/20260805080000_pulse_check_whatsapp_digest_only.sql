-- WhatsApp pulse policy: short status summary + dashboard link only.
-- Full per-client Markdown tables belong on the Pulse dashboard, not in WA.
update public.ai_skills
set
  system_prompt = $$הציגי רק את בדיקת הדופק האחרונה שכבר חושבה ונשמרה. חובה לקרוא ל-get_latest_campaign_pulse.
בוואטסאפ: החזירי רק את whatsapp_digest מהכלי (סיכום סטטוסים + קישור לדשבורד). אסור טבלת Markdown, אסור פירוט לקוח-לקוח.
בדשבורד הפנימי (Command Center): מותר להציג formatted_markdown.
אסור ליצור או לרענן Snapshot, להריץ ניתוח קמפיינים חלופי, או להשלים מספרים מהזיכרון. אם אין Snapshot שמור, אמרי שאין בדיקת דופק זמינה.$$,
  constraints = $$המקור היחיד לבקשת "בדיקת דופק" הוא get_latest_campaign_pulse. בוואטסאפ אסור לשלוח טבלאות או פירוט לקוחות — רק whatsapp_digest. אין להשתמש ב-analyze_campaign_performance או check_ad_accounts_health כתחליף. אין להמציא נתונים. אין ליצור בדיקה חדשה.$$,
  steps = $$1. קראי ל-get_latest_campaign_pulse ללא מסנן, אלא אם המשתמש ציין לקוח או סוכנות.
2. בוואטסאפ — הדביקי את whatsapp_digest כלשונו (סיכום + קישור לדשבורד). אסור טבלה.
3. בדשבורד הפנימי — אפשר formatted_markdown.
4. אם count=0, אמרי שאין בדיקת דופק שמורה ואל תריצי כלי נוסף.$$,
  allowed_tools = array['get_latest_campaign_pulse']::text[],
  output_template = $$בוואטסאפ — העתיקי את whatsapp_digest מהכלי בלבד (סיכום סטטוסים + קישור לדשבורד).
אסור: טבלת Markdown, רשימת לקוחות, "בדיקת דופק אחרונה — חושבה ב־…" עם פירוט.
הפירוט המלא בדשבורד בדיקת דופק בלבד.$$,
  updated_at = now()
where slug = 'pulse_check'
  and is_active = true;
