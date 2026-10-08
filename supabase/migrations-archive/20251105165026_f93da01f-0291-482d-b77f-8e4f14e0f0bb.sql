-- Add parent_tenant_id to support sub-tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS parent_tenant_id uuid REFERENCES public.tenants(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tenants_parent_id ON public.tenants(parent_tenant_id);

-- Add comment
COMMENT ON COLUMN public.tenants.parent_tenant_id IS 'Parent tenant ID for sub-organizations';