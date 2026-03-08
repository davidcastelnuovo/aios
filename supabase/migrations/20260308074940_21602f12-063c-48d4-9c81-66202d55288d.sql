
-- Create client_contacts table
CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  contact_name text NOT NULL,
  phone text,
  email text,
  role text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view client contacts in their tenant"
  ON public.client_contacts FOR SELECT TO authenticated
  USING (
    tenant_id = get_effective_tenant_id()
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert client contacts in their tenant"
  ON public.client_contacts FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_effective_tenant_id()
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update client contacts in their tenant"
  ON public.client_contacts FOR UPDATE TO authenticated
  USING (
    tenant_id = get_effective_tenant_id()
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete client contacts in their tenant"
  ON public.client_contacts FOR DELETE TO authenticated
  USING (
    tenant_id = get_effective_tenant_id()
    OR is_super_admin(auth.uid())
  );
