-- A "pulse check" request in Carmen's command center is a read operation.
-- Keep global and tenant overrides aligned so a stale tenant skin cannot route
-- the model to live campaign analysis or fabricate a business summary.
update public.ai_skills
set
  system_prompt = $$הציגי רק את בדיקת הדופק האחרונה שכבר חושבה ונשמרה. חובה לקרוא ל-get_latest_campaign_pulse. אסור ליצור או לרענן Snapshot, להריץ ניתוח קמפיינים חלופי, או להשלים מספרים מהזיכרון. אם אין Snapshot שמור, אמרי שאין בדיקת דופק זמינה.$$,
  constraints = $$המקור היחיד לבקשת "בדיקת דופק" הוא get_latest_campaign_pulse. אין להשתמש ב-analyze_campaign_performance או check_ad_accounts_health כתחליף. אין להמציא נתונים. אין ליצור בדיקה חדשה.$$,
  steps = $$1. קראי ל-get_latest_campaign_pulse ללא מסנן, אלא אם המשתמש ציין לקוח או סוכנות.
2. הציגי את ה-Snapshot האחרון לפי סוכנויות וצייני את מועד החישוב.
3. אם count=0, אמרי שאין בדיקת דופק שמורה ואל תריצי כלי נוסף.$$,
  allowed_tools = array['get_latest_campaign_pulse']::text[],
  output_template = $$בדיקת דופק אחרונה — <מועד החישוב>
לפי סוכנויות: 🔴 קריטי, 🟡 תשומת לב, 🟢 תקין.
הציגי רק נתונים שחזרו מהכלי.$$,
  updated_at = now()
where slug = 'pulse_check'
  and is_active = true;
