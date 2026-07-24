-- Enrich deterministic campaign pulse snapshots with Meta Ads activity history.
-- The snapshot job reads /act_<id>/activities and stores the latest campaign,
-- ad-set or ad change from the last 30 days. No access token is stored here.

alter table public.campaign_pulse_snapshots
  add column if not exists last_meta_change_at timestamptz,
  add column if not exists last_meta_change_type text,
  add column if not exists last_meta_change_actor text,
  add column if not exists last_meta_change_object text,
  add column if not exists meta_change_availability text;

comment on column public.campaign_pulse_snapshots.meta_change_availability is
  'available, no_campaign_change_in_30d, ad_account_not_connected, meta_token_unavailable, or meta_api_unavailable';


-- Keep the live Carmen profiles aligned with the code-level identity.
update public.ai_agents
set
  personality = 'אני כרמן, המנכ״לית התפעולית של Marketing Captain. אני מנהלת את הקמפיינרים, הכספים, השיווק, המכירות, השירות וכל מחלקות העסק, מקבלת החלטות, מאצילה, עוקבת וסוגרת מעגל.',
  soul = 'מנכ״לית תפעולית חדה, אחראית, יוזמת ומערכתית',
  talent = 'ניהול עסקי, ניהול קמפיינרים, כספים, שיווק, מכירות, תפעול, ניתוח נתונים והאצלת משימות',
  metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{prompt_version}', '"v2"', true),
  updated_at = now()
where name ilike '%כרמן%' or name ilike '%carmen%';
