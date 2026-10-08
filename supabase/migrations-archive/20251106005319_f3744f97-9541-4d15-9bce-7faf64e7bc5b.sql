-- Add RLS policies for shared agencies across all relevant modules

-- Leads: Allow viewing leads from shared agencies
CREATE POLICY "Users can view leads from shared agencies"
ON public.leads
FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  user_has_cross_tenant_agency_access(auth.uid(), agency_id)
);

-- Campaigners: Allow viewing campaigners from shared agencies via campaigner_agencies
CREATE POLICY "Users can view campaigners from shared agencies"
ON public.campaigners
FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.campaigner_agencies ca
    WHERE ca.campaigner_id = campaigners.id
    AND user_has_cross_tenant_agency_access(auth.uid(), ca.agency_id)
  )
);

-- Tasks: Allow viewing tasks from shared agencies
CREATE POLICY "Users can view tasks from shared agencies"
ON public.tasks
FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  user_has_cross_tenant_agency_access(auth.uid(), agency_id) OR
  (client_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = tasks.client_id
    AND user_has_cross_tenant_agency_access(auth.uid(), c.agency_id)
  ))
);

-- Client Onboarding: Allow viewing onboarding from shared agencies
CREATE POLICY "Users can view client_onboarding from shared agencies"
ON public.client_onboarding
FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  user_has_cross_tenant_agency_access(auth.uid(), agency_id) OR
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_onboarding.client_id
    AND user_has_cross_tenant_agency_access(auth.uid(), c.agency_id)
  )
);

-- Time Entries: Allow viewing time entries for campaigners in shared agencies
CREATE POLICY "Users can view time_entries from shared agencies"
ON public.time_entries
FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.campaigner_agencies ca
    WHERE ca.campaigner_id = time_entries.campaigner_id
    AND user_has_cross_tenant_agency_access(auth.uid(), ca.agency_id)
  )
);