-- Add whatsapp_avatar_url column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS whatsapp_avatar_url TEXT;

-- Add whatsapp_avatar_url column to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS whatsapp_avatar_url TEXT;

-- Add whatsapp_avatar_url column to whatsapp_groups table
ALTER TABLE public.whatsapp_groups 
ADD COLUMN IF NOT EXISTS whatsapp_avatar_url TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_avatar ON public.leads(whatsapp_avatar_url) WHERE whatsapp_avatar_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_whatsapp_avatar ON public.clients(whatsapp_avatar_url) WHERE whatsapp_avatar_url IS NOT NULL;