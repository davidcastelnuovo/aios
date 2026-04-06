ALTER TABLE public.carmen_whatsapp_sessions 
ADD COLUMN IF NOT EXISTS automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL;