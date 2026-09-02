-- Carmen skin: connect Meta/Facebook ad account to a client (clients.meta_ads_account_id).
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  trigger_phrases, triggers, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'connect_client_meta_ad_account',
  'חיבור חשבון Meta Ads ללקוח',
  'מחברת חשבון מודעות Meta/Facebook (act_...) ללקוח ב-CRM דרך connect_client_meta_ad_account.',
  ARRAY[
    'חברי חשבון פייסבוק ללקוח',
    'חברי חשבון מטא ללקוח',
    'connect meta ad account',
    'act_',
    'meta ads account id',
    'חשבון מודעות פייסבוק'
  ],
  ARRAY[
    'חיבור Meta Ads',
    'שיוך act_'
  ],
  $$1. אמתי client_id (UUID) ו-ad_account_id (act_... או ספרות).
2. חפשי לקוח עם search_entities / get_client_info — אל תנחשי UUID.
3. אם יש חשבון Meta אחר מחובר — הציגי אזהרה ובקשי אישור מפורש מדוד לפני confirm_replace=true.
4. קראי connect_client_meta_ad_account(client_id, ad_account_id, account_name?, confirm_replace?).
5. דווחי before/after מהתשובה.$$,
  $$כשדוד מבקש לחבר חשבון Meta/Facebook ללקוח:
1. ודאי client_id + ad_account_id (act_561430705400571).
2. השתמשי ב-connect_client_meta_ad_account — לא ב-update_client כללי.
3. אם requires_confirmation=true — עצרי והציגי חשבון קיים מול מבוקש. רק אחרי "כן" — confirm_replace=true.
4. אחרי success — סכמי לדוד: לקוח, ad_account_id, before/after.
5. אם הלקוח צריך גם טבלת facebook_insights — create_facebook_report_table נפרד; הכלי מעדכן clients.meta_ads_account_id ומסנכרן טבלה קיימת.$$,
  'לא להחליף חשבון Meta בלי אישור. לא להרחיב גישה מעבר ללקוחות בסקופ.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'connect_client_meta_ad_account'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
