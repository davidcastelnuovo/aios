-- Create client_updates table for client updates history
CREATE TABLE public.client_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view client updates in their tenant"
ON public.client_updates
FOR SELECT
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can create client updates in their tenant"
ON public.client_updates
FOR INSERT
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can update own client updates"
ON public.client_updates
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own client updates"
ON public.client_updates
FOR DELETE
USING (user_id = auth.uid());

-- Create index for better performance
CREATE INDEX idx_client_updates_client_id ON public.client_updates(client_id);
CREATE INDEX idx_client_updates_tenant_id ON public.client_updates(tenant_id);