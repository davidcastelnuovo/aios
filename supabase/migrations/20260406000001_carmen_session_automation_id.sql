-- Add automation_id to carmen_whatsapp_sessions for timeout and scope lookups
ALTER TABLE public.carmen_whatsapp_sessions
  ADD COLUMN IF NOT EXISTS automation_id UUID REFERENCES public.automations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_carmen_sessions_automation
  ON carmen_whatsapp_sessions(automation_id);
