ALTER TABLE public.crm_dashboards DROP CONSTRAINT IF EXISTS crm_dashboards_type_check;
ALTER TABLE public.crm_dashboards ADD CONSTRAINT crm_dashboards_type_check CHECK (dashboard_type IN ('client', 'agency', 'organization'));
ALTER TABLE public.crm_dashboards ALTER COLUMN agency_id DROP NOT NULL;