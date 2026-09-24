ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leads_default_stage text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_leads_default_stage_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_leads_default_stage_check
  CHECK (leads_default_stage IS NULL OR leads_default_stage IN ('all', 'new'));

COMMENT ON COLUMN public.profiles.leads_default_stage IS
  'Per-user default CRM lead list: all pipeline stages, or new leads only.';
