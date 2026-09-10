-- Carmen skin: WhatsApp group sender identity + authorization pipeline
-- Tenant: marketingcaptain (2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019)
-- Apply on Staging via apply-staging-sql-migration.yml

insert into public.ai_skills (
  tenant_id,
  scope,
  slug,
  name,
  description,
  system_prompt,
  triggers,
  is_active,
  created_by_agent
) values (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'tenant',
  'carmen_whatsapp_group_sender_identity',
  'זיהוי שולח בקבוצות WhatsApp',
  'מסבירה איך participant_phone נשמר ומועבר לכרמן בקבוצות, והפרדת הרשאות פרטי מול קבוצה.',
  $$בקבוצות WhatsApp — זיהוי שולח:
1. sender/participant_phone נשמר ב-chat_messages (Green API + Manus) — לא group_id.
2. handleCarmenMessage מריץ resolveCarmenGroupIdentity + מוסיף [שולח בקבוצה] participant_phone=… לקונטקסט.
3. run-ai-agent מקבל lead_data.phone + channel=whatsapp_group.
4. הרשאות: carmen_allowed_phones = פרטי; בקבוצה רק מנהלים ברשימה או carmen_whatsapp_identities מאושר. אנה (972545612156) — פרטי בלבד אלא אם מאושרת לקבוצה.
5. כרמן עונה בקבוצה רק כשפונים אליה ישירות (כרמן/קארמן + בקשה).$$,
  array[
    'participant_phone',
    'sender_phone קבוצה',
    'group sender identity',
    'מי שלח בקבוצה',
    'הרשאות קבוצה כרמן'
  ],
  true,
  true
)
on conflict (tenant_id, slug) where scope = 'tenant'
do update set
  name = excluded.name,
  description = excluded.description,
  system_prompt = excluded.system_prompt,
  triggers = excluded.triggers,
  is_active = true,
  updated_at = now();
