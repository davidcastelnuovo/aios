ALTER TABLE public.report_alerts ADD COLUMN IF NOT EXISTS last_triggered_at timestamptz DEFAULT NULL;
ALTER TABLE public.report_alerts ADD COLUMN IF NOT EXISTS last_triggered_data jsonb DEFAULT NULL;