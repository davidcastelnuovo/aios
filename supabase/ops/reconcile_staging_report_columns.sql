-- Additive Staging reconciliation, observed against Production on 2026-09-10.
-- Existing policies, enum types, function bodies and grants are preserved.
ALTER TABLE public.campaign_pulse_snapshots ADD COLUMN IF NOT EXISTS last_client_call_at timestamptz;
ALTER TABLE public.campaign_pulse_snapshots ADD COLUMN IF NOT EXISTS last_client_call_by text;
ALTER TABLE public.client_updates ADD COLUMN IF NOT EXISTS update_type text;
ALTER TABLE public.crm_records ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.site_visitors ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS payment numeric;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignment_notification_sent_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS high_priority_reminder_sent_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS high_priority_creator_notified_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_creator_notified_at timestamptz;
