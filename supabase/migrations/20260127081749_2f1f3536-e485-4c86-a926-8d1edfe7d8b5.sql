-- Create junction table for many-to-many relationship between leads and sales_people
CREATE TABLE public.lead_sales_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sales_person_id UUID NOT NULL REFERENCES public.sales_people(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id, sales_person_id)
);

-- Create index for better query performance
CREATE INDEX idx_lead_sales_people_lead_id ON public.lead_sales_people(lead_id);
CREATE INDEX idx_lead_sales_people_sales_person_id ON public.lead_sales_people(sales_person_id);
CREATE INDEX idx_lead_sales_people_tenant_id ON public.lead_sales_people(tenant_id);

-- Enable Row Level Security
ALTER TABLE public.lead_sales_people ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT: Users can see assignments in their tenant
CREATE POLICY "Users can view lead_sales_people in their tenant"
ON public.lead_sales_people
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id(auth.uid())
);

-- INSERT: Owners/team managers can create assignments
CREATE POLICY "Owners can insert lead_sales_people"
ON public.lead_sales_people
FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'team_manager'))
  )
);

-- UPDATE: Owners/team managers can update assignments
CREATE POLICY "Owners can update lead_sales_people"
ON public.lead_sales_people
FOR UPDATE
USING (
  is_super_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'team_manager'))
  )
);

-- DELETE: Owners/team managers can delete assignments
CREATE POLICY "Owners can delete lead_sales_people"
ON public.lead_sales_people
FOR DELETE
USING (
  is_super_admin(auth.uid()) 
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'team_manager'))
  )
);

-- Migrate existing data from leads.sales_person_id to the new junction table
INSERT INTO public.lead_sales_people (lead_id, sales_person_id, tenant_id)
SELECT id, sales_person_id, tenant_id 
FROM public.leads 
WHERE sales_person_id IS NOT NULL AND tenant_id IS NOT NULL
ON CONFLICT (lead_id, sales_person_id) DO NOTHING;