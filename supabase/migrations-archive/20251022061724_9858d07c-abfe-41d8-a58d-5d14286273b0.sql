-- Agency manager visibility: allow access to all data within their managed agencies

-- Clients
DROP POLICY IF EXISTS "Agency managers can select clients in managed agencies" ON public.clients;
CREATE POLICY "Agency managers can select clients in managed agencies"
ON public.clients
FOR SELECT
USING (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can insert clients in managed agencies" ON public.clients;
CREATE POLICY "Agency managers can insert clients in managed agencies"
ON public.clients
FOR INSERT
WITH CHECK (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can update clients in managed agencies" ON public.clients;
CREATE POLICY "Agency managers can update clients in managed agencies"
ON public.clients
FOR UPDATE
USING (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can delete clients in managed agencies" ON public.clients;
CREATE POLICY "Agency managers can delete clients in managed agencies"
ON public.clients
FOR DELETE
USING (public.user_manages_agency(auth.uid(), agency_id));

-- Tasks
DROP POLICY IF EXISTS "Agency managers can select tasks in managed agencies" ON public.tasks;
CREATE POLICY "Agency managers can select tasks in managed agencies"
ON public.tasks
FOR SELECT
USING (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can insert tasks in managed agencies" ON public.tasks;
CREATE POLICY "Agency managers can insert tasks in managed agencies"
ON public.tasks
FOR INSERT
WITH CHECK (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can update tasks in managed agencies" ON public.tasks;
CREATE POLICY "Agency managers can update tasks in managed agencies"
ON public.tasks
FOR UPDATE
USING (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can delete tasks in managed agencies" ON public.tasks;
CREATE POLICY "Agency managers can delete tasks in managed agencies"
ON public.tasks
FOR DELETE
USING (public.user_manages_agency(auth.uid(), agency_id));

-- Client Onboarding
DROP POLICY IF EXISTS "Agency managers can select onboarding in managed agencies" ON public.client_onboarding;
CREATE POLICY "Agency managers can select onboarding in managed agencies"
ON public.client_onboarding
FOR SELECT
USING (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can insert onboarding in managed agencies" ON public.client_onboarding;
CREATE POLICY "Agency managers can insert onboarding in managed agencies"
ON public.client_onboarding
FOR INSERT
WITH CHECK (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can update onboarding in managed agencies" ON public.client_onboarding;
CREATE POLICY "Agency managers can update onboarding in managed agencies"
ON public.client_onboarding
FOR UPDATE
USING (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can delete onboarding in managed agencies" ON public.client_onboarding;
CREATE POLICY "Agency managers can delete onboarding in managed agencies"
ON public.client_onboarding
FOR DELETE
USING (public.user_manages_agency(auth.uid(), agency_id));

-- Finance
DROP POLICY IF EXISTS "Agency managers can select finance in managed agencies" ON public.finance;
CREATE POLICY "Agency managers can select finance in managed agencies"
ON public.finance
FOR SELECT
USING (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can insert finance in managed agencies" ON public.finance;
CREATE POLICY "Agency managers can insert finance in managed agencies"
ON public.finance
FOR INSERT
WITH CHECK (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can update finance in managed agencies" ON public.finance;
CREATE POLICY "Agency managers can update finance in managed agencies"
ON public.finance
FOR UPDATE
USING (public.user_manages_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency managers can delete finance in managed agencies" ON public.finance;
CREATE POLICY "Agency managers can delete finance in managed agencies"
ON public.finance
FOR DELETE
USING (public.user_manages_agency(auth.uid(), agency_id));

-- Agencies
DROP POLICY IF EXISTS "Agency managers can view their agencies" ON public.agencies;
CREATE POLICY "Agency managers can view their agencies"
ON public.agencies
FOR SELECT
USING (public.user_manages_agency(auth.uid(), id));

-- Suppliers
DROP POLICY IF EXISTS "Agency managers can select suppliers in managed agencies" ON public.suppliers;
CREATE POLICY "Agency managers can select suppliers in managed agencies"
ON public.suppliers
FOR SELECT
USING (
  public.user_manages_agency(auth.uid(), agency_id_1) OR 
  public.user_manages_agency(auth.uid(), agency_id_2) OR 
  public.user_manages_agency(auth.uid(), agency_id_3)
);

DROP POLICY IF EXISTS "Agency managers can insert suppliers in managed agencies" ON public.suppliers;
CREATE POLICY "Agency managers can insert suppliers in managed agencies"
ON public.suppliers
FOR INSERT
WITH CHECK (
  public.user_manages_agency(auth.uid(), agency_id_1) OR 
  public.user_manages_agency(auth.uid(), agency_id_2) OR 
  public.user_manages_agency(auth.uid(), agency_id_3)
);

DROP POLICY IF EXISTS "Agency managers can update suppliers in managed agencies" ON public.suppliers;
CREATE POLICY "Agency managers can update suppliers in managed agencies"
ON public.suppliers
FOR UPDATE
USING (
  public.user_manages_agency(auth.uid(), agency_id_1) OR 
  public.user_manages_agency(auth.uid(), agency_id_2) OR 
  public.user_manages_agency(auth.uid(), agency_id_3)
);

DROP POLICY IF EXISTS "Agency managers can delete suppliers in managed agencies" ON public.suppliers;
CREATE POLICY "Agency managers can delete suppliers in managed agencies"
ON public.suppliers
FOR DELETE
USING (
  public.user_manages_agency(auth.uid(), agency_id_1) OR 
  public.user_manages_agency(auth.uid(), agency_id_2) OR 
  public.user_manages_agency(auth.uid(), agency_id_3)
);
