-- "Campaign active" flag on report tables: Carmen's pulse/connection checks
-- report only on tables whose campaign is supposed to be running, and she can
-- flip the flag herself (set_campaign_table_active tool) when told a campaign
-- is off. Default true so existing tables keep current behavior.

ALTER TABLE public.crm_tables
  ADD COLUMN IF NOT EXISTS campaign_active boolean NOT NULL DEFAULT true;
