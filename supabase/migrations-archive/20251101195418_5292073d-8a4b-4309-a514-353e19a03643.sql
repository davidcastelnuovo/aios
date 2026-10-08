-- Create import_history table for backup of uploaded files
CREATE TABLE public.import_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  import_type TEXT NOT NULL CHECK (import_type IN ('leads', 'clients')),
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  records_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Users can view import history in their tenant
CREATE POLICY "Users can view import_history in their tenant"
ON public.import_history
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
);

-- Users can insert import history in their tenant
CREATE POLICY "Users can insert import_history in their tenant"
ON public.import_history
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid())
);

-- Create index for faster queries
CREATE INDEX idx_import_history_tenant_id ON public.import_history(tenant_id);
CREATE INDEX idx_import_history_imported_at ON public.import_history(imported_at DESC);