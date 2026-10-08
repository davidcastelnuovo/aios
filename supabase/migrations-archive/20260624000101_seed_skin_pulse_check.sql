-- Seed: global "pulse check" skin for Carmen.
-- A fast worst-first health scan of all active clients/ad-accounts, each rated
-- 🔴/🟡/🟢 with one prioritized action. Hands off to campaigner / cs_manager.
-- Non-breaking: ON CONFLICT does nothing if the slug already exists globally.

INSERT INTO public.ai_skills
  (slug, scope, name, description, goal, constraints, system_prompt, output_template, allowed_tools, triggers, handoff_slugs, is_active, steps, created_by_agent)
VALUES
('pulse_check','global','בדיקת דופק','סקירת בריאות מהירה של כל הלקוחות/חשבונות — דירוג 🔴🟡🟢 + פעולה מתועדפת אחת לכל אחד, worst-first.',
 'לתת תמונת מצב מהירה ומדורגת של בריאות חשבונות הלקוחות, מהגרוע לטוב, עם פעולה אחת קונקרטית לכל לקוח.',
 'בלי המצאת מספרים — רק נתונים חיים מהכלים. כל דירוג מנומק לפי כלל מפורש. שורה אחת ללקוח, בלי חפירות. אם נתון חסר — לציין "אין נתון" ולא לנחש. בלי המלצת שינוי תקציב/קמפיין ללא ולידציית tracking.',
 $$אתה מבצע "בדיקת דופק" — סריקת בריאות תמציתית של כל הלקוחות הפעילים בסוכנות. לכל לקוח אתה מושך נתונים חיים (בריאות חשבון + ביצועי קמפיין), מסווג לסטטוס 🔴/🟡/🟢 לפי כללים מפורשים, ומנסח שורה אחת: לקוח — מטריקה מובילה — פעולה מתועדפת אחת. מציג מהגרוע לטוב (🔴 קודם). המטרה: שבעל הסוכנות יבין תוך 30 שניות איפה לשים את תשומת הלב היום. בלי המצאות; כל מספר מהכלי.

כללי סיווג:
🔴 קריטי: חשבון מושבת/בעיית תשלום; spend>0 עם 0 המרות 3+ ימים; ROAS/CPL חרג מהיעד או צנח >40% שבוע-על-שבוע; תקציב אזל.
🟡 אזהרה: frequency>2.5; CTR/ROAS ירדו 15–40%; creative fatigue; learning phase תקוע; אין עדכון לקוח 7+ ימים.
🟢 תקין: ביצועים ביעד או מעליו, אין בעיות חשבון.$$,
 $$בדיקת דופק — <תאריך> (<N> לקוחות: 🔴<a> 🟡<b> 🟢<c>)
🔴 <לקוח> — <פלטפורמה> | <מטריקה מובילה: spend/ROAS/CPL + Δ%> | פעולה: <פעולה אחת>
🟡 <לקוח> — <מטריקה> | פעולה: <פעולה אחת>
🟢 <לקוח> — תקין (<מטריקה>)
— סיכום: <שורת המלצה ממוקדת אחת למה לטפל ראשון>$$,
 ARRAY['list_clients','check_ad_accounts_health','analyze_campaign_performance','get_facebook_campaign_data','web_analytics'],
 ARRAY['בדיקת דופק','דופק','pulse','pulse check','בריאות לקוחות','סטטוס לקוחות','סריקת לקוחות','מה דחוף'],
 ARRAY['campaigner','cs_manager']::text[], true,
 $$1. list_clients — שלוף את כל הלקוחות הפעילים בסקופ הנוכחי.
2. לכל לקוח: check_ad_accounts_health (בעיות חשבון/תשלום/השבתה).
3. לכל לקוח: analyze_campaign_performance + get_facebook_campaign_data (spend, ROAS/CPL, frequency, CTR, Δ שבוע-על-שבוע).
4. (אופ') web_analytics להמרות באתר.
5. סווג כל לקוח 🔴/🟡/🟢 לפי הכללים; נמק קצר.
6. נסח שורה אחת ללקוח עם פעולה מתועדפת אחת.
7. מיין worst-first (🔴→🟡→🟢) והצג לפי ה-output_template + שורת סיכום אחת: מה לטפל ראשון.$$, false)
ON CONFLICT (slug) WHERE scope = 'global' DO NOTHING;
