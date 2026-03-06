
CREATE TABLE IF NOT EXISTS public.team_chat_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.team_messages(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'file',
  file_size bigint,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_chat_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files in their tenant"
  ON public.team_chat_files FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert files in their tenant"
  ON public.team_chat_files FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update their own files"
  ON public.team_chat_files FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can delete their own files"
  ON public.team_chat_files FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_super_admin(auth.uid()));
