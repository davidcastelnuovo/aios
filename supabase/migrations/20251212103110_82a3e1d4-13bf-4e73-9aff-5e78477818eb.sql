-- Add shared_from_integration_id column to tenant_integrations
ALTER TABLE public.tenant_integrations 
ADD COLUMN IF NOT EXISTS shared_from_integration_id uuid REFERENCES public.tenant_integrations(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_shared_from 
ON public.tenant_integrations(shared_from_integration_id) 
WHERE shared_from_integration_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tenant_integrations.shared_from_integration_id IS 'Reference to the original integration this connection is shared from';