ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leads_default_view text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_leads_default_view_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_leads_default_view_check
  CHECK (leads_default_view IS NULL OR leads_default_view IN ('kanban', 'table', 'chat'));

COMMENT ON COLUMN public.profiles.leads_default_view IS
  'Per-user default CRM leads view: kanban (pipeline), table, or chat.';
