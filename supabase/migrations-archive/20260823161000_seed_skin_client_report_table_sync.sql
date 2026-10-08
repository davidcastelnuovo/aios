-- Tenant skin: Carmen understands report-table ↔ client-card sync.
INSERT INTO public.ai_skills
  (slug, scope, tenant_id, name, description, goal, constraints, system_prompt, output_template, allowed_tools, triggers, is_active, steps, created_by_agent)
SELECT
  'client_report_table_sync',
  'tenant',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'סנכרון כרטיס לקוח מטבלאות דוח',
  'כשיש טבלת דוח (crm_tables) משויכת ללקוח — היא מקור האמת לחיבור Google/Meta/GA/Ahrefs/GSC, גם אם שדה הכרטיס ריק.',
  'לזהות חיבורי קמפיין/דוחות לפי טבלאות משויכות, לא רק שדות clients.*, ולהסביר למשתמש.',
  'אל תגידי "לא מחובר" אם קיימת טבלת google_ads / facebook_insights / facebook_ecommerce משויכת ללקוח — גם בלי google_ads_account_id/meta_ads_account_id. אם חסר account id בהגדרות הטבלה — דווחי על כך במפורש.',
  $$כשבודקים חיבור Google Ads / Meta / GA / Ahrefs / GSC ללקוח:
1. חפשי crm_tables עם client_id + integration_type (google_ads, facebook_insights, facebook_ecommerce, google_analytics, ahrefs, google_search_console).
2. אם יש טבלה משויכת — הלקוח **מחובר** (גם אם clients.google_ads_account_id או meta_ads_account_id ריקים).
3. list_google_campaigns עם client_id — ה-customer_id נפתר מטבלת google_ads (integration_settings.customer_id) ואז מכרטיס הלקוח.
4. analyze_campaign_performance / find_campaign_tables — כבר משתמשים בטבלאות; "לא מחובר" רק כשאין טבלה בכלל.
5. אם טבלה משויכת אך חסר account id בהגדרות — הסבירי שחסר customer_id/ad_account_id ב-integration_settings ושהכרטיס יתעדכן אוטומטית כשיתוקן.$$,
  NULL,
  ARRAY['list_clients','list_google_campaigns','analyze_campaign_performance','find_campaign_tables','check_ad_accounts_health'],
  ARRAY['google ads לא מחובר','אין google_ads_account_id','טבלת דוח','report table','client card sync','כרטיס לקוח','crm_tables','לא מחובר google','meta לא מחובר'],
  true,
  $$1. list_clients / search_entities לזהות client_id.
2. find_campaign_tables או query crm_tables לפי client_id.
3. אם יש google_ads — קראי list_google_campaigns(client_id=...) (לא דורש connect_google_ads_account).
4. אם אין טבלה — אז באמת לא מחובר; הציעי create_*_report_table או connect_*.$$,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills s
  WHERE s.slug = 'client_report_table_sync'
    AND s.scope = 'tenant'
    AND s.tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
