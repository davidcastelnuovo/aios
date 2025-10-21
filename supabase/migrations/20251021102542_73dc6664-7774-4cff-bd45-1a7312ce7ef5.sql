-- שלב 1: הסרת כל הפוליסיות שתלויות בפונקציה get_user_agency_id
-- Policies של campaigners
DROP POLICY IF EXISTS "Users can view their agency campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Users can insert their agency campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Users can update their agency campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Users can delete their agency campaigners" ON public.campaigners;

-- Policies של clients
DROP POLICY IF EXISTS "Users can view their agency clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their agency clients" ON public.clients;

-- Policies של tasks
DROP POLICY IF EXISTS "Users can view their agency tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert their agency tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their agency tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their agency tasks" ON public.tasks;

-- Policies של client_onboarding
DROP POLICY IF EXISTS "Users can view their agency onboarding" ON public.client_onboarding;
DROP POLICY IF EXISTS "Users can insert their agency onboarding" ON public.client_onboarding;
DROP POLICY IF EXISTS "Users can update their agency onboarding" ON public.client_onboarding;
DROP POLICY IF EXISTS "Users can delete their agency onboarding" ON public.client_onboarding;

-- Policies של agencies
DROP POLICY IF EXISTS "Users can view their own agency" ON public.agencies;
DROP POLICY IF EXISTS "Users can view their agencies" ON public.agencies;

-- Policies של finance
DROP POLICY IF EXISTS "Users can view their agency finance" ON public.finance;
DROP POLICY IF EXISTS "Users can insert their agency finance" ON public.finance;
DROP POLICY IF EXISTS "Users can update their agency finance" ON public.finance;
DROP POLICY IF EXISTS "Users can delete their agency finance" ON public.finance;

-- Policies של suppliers
DROP POLICY IF EXISTS "Users can view their agency suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert their agency suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update their agency suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete their agency suppliers" ON public.suppliers;

-- שלב 2: הסרת העמודה והאינדקס
DROP INDEX IF EXISTS idx_campaigners_agency_id;
ALTER TABLE public.campaigners DROP COLUMN IF EXISTS agency_id;

-- שלב 3: הסרת הפונקציה הישנה
DROP FUNCTION IF EXISTS public.get_user_agency_id(uuid);

-- שלב 4: יצירת טבלת החיבור
CREATE TABLE IF NOT EXISTS public.campaigner_agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaigner_id uuid NOT NULL REFERENCES public.campaigners(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(campaigner_id, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_campaigner_agencies_campaigner ON public.campaigner_agencies(campaigner_id);
CREATE INDEX IF NOT EXISTS idx_campaigner_agencies_agency ON public.campaigner_agencies(agency_id);

-- שלב 5: יצירת הפונקציות החדשות
CREATE OR REPLACE FUNCTION public.get_user_agency_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(ca.agency_id)
  FROM public.profiles p
  JOIN public.campaigner_agencies ca ON ca.campaigner_id = p.campaigner_id
  WHERE p.id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.user_has_agency_access(_user_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.campaigner_agencies ca ON ca.campaigner_id = p.campaigner_id
    WHERE p.id = _user_id AND ca.agency_id = _agency_id
  )
$$;

-- שלב 6: RLS policies לטבלת campaigner_agencies
ALTER TABLE public.campaigner_agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaigner agencies" 
ON public.campaigner_agencies FOR SELECT USING (true);

CREATE POLICY "Admins can insert campaigner agencies" 
ON public.campaigner_agencies FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update campaigner agencies" 
ON public.campaigner_agencies FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can delete campaigner agencies" 
ON public.campaigner_agencies FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- שלב 7: יצירת פוליסיות חדשות לכל הטבלאות
-- Clients
CREATE POLICY "Users can view their agency clients" ON public.clients FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency clients" ON public.clients FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

-- Tasks
CREATE POLICY "Users can view their agency tasks" ON public.tasks FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency tasks" ON public.tasks FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency tasks" ON public.tasks FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency tasks" ON public.tasks FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

-- Client Onboarding
CREATE POLICY "Users can view their agency onboarding" ON public.client_onboarding FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency onboarding" ON public.client_onboarding FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency onboarding" ON public.client_onboarding FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency onboarding" ON public.client_onboarding FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

-- Agencies
CREATE POLICY "Users can view their agencies" ON public.agencies FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), id));

-- Finance
CREATE POLICY "Users can view their agency finance" ON public.finance FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency finance" ON public.finance FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency finance" ON public.finance FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency finance" ON public.finance FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id));

-- Suppliers
CREATE POLICY "Users can view their agency suppliers" ON public.suppliers FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id_1) OR user_has_agency_access(auth.uid(), agency_id_2) OR user_has_agency_access(auth.uid(), agency_id_3));

CREATE POLICY "Users can insert their agency suppliers" ON public.suppliers FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id_1) OR user_has_agency_access(auth.uid(), agency_id_2) OR user_has_agency_access(auth.uid(), agency_id_3));

CREATE POLICY "Users can update their agency suppliers" ON public.suppliers FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id_1) OR user_has_agency_access(auth.uid(), agency_id_2) OR user_has_agency_access(auth.uid(), agency_id_3));

CREATE POLICY "Users can delete their agency suppliers" ON public.suppliers FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR user_has_agency_access(auth.uid(), agency_id_1) OR user_has_agency_access(auth.uid(), agency_id_2) OR user_has_agency_access(auth.uid(), agency_id_3));

-- Campaigners
CREATE POLICY "Users can view their agency campaigners" ON public.campaigners FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role) OR EXISTS (SELECT 1 FROM public.campaigner_agencies ca WHERE ca.campaigner_id = id AND user_has_agency_access(auth.uid(), ca.agency_id)));

CREATE POLICY "Admins can insert campaigners" ON public.campaigners FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update campaigners" ON public.campaigners FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can delete campaigners" ON public.campaigners FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));