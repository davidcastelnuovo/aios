-- Table to track contacts that user manually marked as read
CREATE TABLE public.manually_read_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  sender_phone TEXT,
  marked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure at least one contact identifier is provided
  CONSTRAINT at_least_one_contact CHECK (
    client_id IS NOT NULL OR lead_id IS NOT NULL OR group_id IS NOT NULL OR sender_phone IS NOT NULL
  )
);

-- Create index for fast lookups
CREATE INDEX idx_manually_read_contacts_user_tenant ON public.manually_read_contacts(user_id, tenant_id);
CREATE INDEX idx_manually_read_contacts_client ON public.manually_read_contacts(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_manually_read_contacts_lead ON public.manually_read_contacts(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_manually_read_contacts_group ON public.manually_read_contacts(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_manually_read_contacts_sender_phone ON public.manually_read_contacts(sender_phone) WHERE sender_phone IS NOT NULL;

-- Enable RLS
ALTER TABLE public.manually_read_contacts ENABLE ROW LEVEL SECURITY;

-- Users can view their own marked read contacts
CREATE POLICY "Users can view their own marked read contacts"
ON public.manually_read_contacts FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own marked read contacts
CREATE POLICY "Users can insert their own marked read contacts"
ON public.manually_read_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own marked read contacts (to un-mark)
CREATE POLICY "Users can delete their own marked read contacts"
ON public.manually_read_contacts FOR DELETE
USING (auth.uid() = user_id);