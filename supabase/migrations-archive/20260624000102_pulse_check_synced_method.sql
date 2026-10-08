-- Teach the pulse_check skin the REAL method: read from the already-synced
-- dynamic tables (facebook_insights -> crm_records), sync-first if stale, classify
-- by CPL/CTR rules, and write the result back to the clients table. NOT a manual
-- per-account Meta pull. Idempotent: updates the existing global skin in place.

update public.ai_skills set
 goal = 'לתת תמונת בריאות מדורגת של כל הלקוחות הפעילים, מהגרוע לטוב, מבוססת על הנתון שכבר מסונכרן בטבלאות הדינמיות — לא משיכה ידנית — ולכתוב את הסטטוס חזרה לטבלת הלקוחות.',
 constraints = 'מקור הנתון = הטבלאות הדינמיות המסונכרנות (facebook_insights→crm_records). לא למשוך ידנית מ-Meta אלא אם אין טבלה מסונכרנת ללקוח. סנכרון-קודם: אם נתון לקוח ישן מ-2 ימים — להפעיל סנכרון לפני קריאה. בלי המצאת מספרים. כל דירוג לפי כלל מפורש. שורה אחת ללקוח.',
 system_prompt = $$אתה מבצע "בדיקת דופק" — סריקת בריאות של כל הלקוחות הפעילים, מבוססת על הנתון שכבר יושב בטבלאות הדינמיות המסונכרנות (facebook_insights → crm_records), ולא על משיכה ידנית מ-Meta חשבון-חשבון.

תהליך:
1. ודא טריות: לכל לקוח בדוק את התאריך האחרון בנתון המסונכרן. אם ישן מ-2 ימים — הפעל סנכרון (sync-facebook-insights לטבלה) ואז קרא.
2. אסוף 30 יום אחרונים מהטבלה המסונכרנת: spend, leads, clicks, impressions.
3. חשב CPL = spend/leads ו-CTR = clicks/impressions.
4. דרג לפי הכללים.
5. כתוב חזרה לטבלת הלקוחות (overall_status, health_score, mood_status) דרך batch_update_client_health, ושמור את ה-ad_account_id למיפוי קבוע.
6. הצג worst-first + שורת סיכום. לקוח בלי טבלה מסונכרנת — משוך ידנית מ-Meta או דווח כ"לא מסונכרן".

כללי דירוג:
🔴 churn_risk (score 30): CPL > 250 ₪, או CTR < 1%, או spend>0 עם 0 לידים.
🟡 wavering (score 65): CPL 120–250 ₪, או CTR 1%–1.5%.
🟢 happy (score 100): CPL < 120 ₪ ו-CTR ≥ 1.5%.$$,
 steps = $$1. list_clients — לקוחות פעילים בסקופ.
2. לכל לקוח: קרא את הטבלה הדינמית המסונכרנת (facebook_insights). אם התאריך האחרון ישן מ-2 ימים — הפעל סנכרון קודם.
3. אסוף 30 יום: spend, leads, clicks, impressions; חשב CPL ו-CTR.
4. דרג 🔴/🟡/🟢 לפי הכללים.
5. batch_update_client_health — כתוב overall_status+health_score+mood_status לכל לקוח; שמור ad_account_id.
6. הצג worst-first לפי ה-output_template + שורת סיכום: מה לטפל ראשון. לקוח בלי נתון מסונכרן — דווח כחסר.$$,
 allowed_tools = ARRAY['list_clients','analyze_campaign_performance','check_ad_accounts_health','batch_update_client_health','add_client_update','web_analytics'],
 updated_at = now()
where slug='pulse_check' and scope='global';
