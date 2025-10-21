-- הוספת agency_id לטבלת campaigners
ALTER TABLE public.campaigners 
ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id);

-- יצירת אינדקס לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_campaigners_agency_id ON public.campaigners(agency_id);

-- פונקציה לקבלת הסוכנות של המשתמש המחובר
CREATE OR REPLACE FUNCTION public.get_user_agency_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.agency_id
  FROM public.profiles p
  JOIN public.campaigners c ON c.id = p.campaigner_id
  WHERE p.id = _user_id
$$;

-- עדכון RLS policies לטבלת clients
DROP POLICY IF EXISTS "Users can view their assigned clients" ON public.clients;
CREATE POLICY "Users can view their agency clients" 
ON public.clients 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their assigned clients" ON public.clients;
CREATE POLICY "Users can update their agency clients" 
ON public.clients 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

-- עדכון RLS policies לטבלת tasks
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON public.tasks;
CREATE POLICY "Users can view their agency tasks" 
ON public.tasks 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
CREATE POLICY "Users can insert their agency tasks" 
ON public.tasks 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their assigned tasks" ON public.tasks;
CREATE POLICY "Users can update their agency tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their assigned tasks" ON public.tasks;
CREATE POLICY "Users can delete their agency tasks" 
ON public.tasks 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

-- עדכון RLS policies לטבלת client_onboarding
DROP POLICY IF EXISTS "Users can view their assigned onboarding" ON public.client_onboarding;
CREATE POLICY "Users can view their agency onboarding" 
ON public.client_onboarding 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own onboarding" ON public.client_onboarding;
CREATE POLICY "Users can insert their agency onboarding" 
ON public.client_onboarding 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their assigned onboarding" ON public.client_onboarding;
CREATE POLICY "Users can update their agency onboarding" 
ON public.client_onboarding 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their assigned onboarding" ON public.client_onboarding;
CREATE POLICY "Users can delete their agency onboarding" 
ON public.client_onboarding 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

-- הוספת policies חדשות לטבלת agencies
CREATE POLICY "Users can view their own agency" 
ON public.agencies 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR id = get_user_agency_id(auth.uid())
);

-- הוספת policies חדשות לטבלת finance
CREATE POLICY "Users can view their agency finance" 
ON public.finance 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

CREATE POLICY "Users can insert their agency finance" 
ON public.finance 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

CREATE POLICY "Users can update their agency finance" 
ON public.finance 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

CREATE POLICY "Users can delete their agency finance" 
ON public.finance 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

-- הוספת policies לטבלת suppliers
CREATE POLICY "Users can view their agency suppliers" 
ON public.suppliers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id_1 = get_user_agency_id(auth.uid())
  OR agency_id_2 = get_user_agency_id(auth.uid())
  OR agency_id_3 = get_user_agency_id(auth.uid())
);

CREATE POLICY "Users can insert their agency suppliers" 
ON public.suppliers 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id_1 = get_user_agency_id(auth.uid())
  OR agency_id_2 = get_user_agency_id(auth.uid())
  OR agency_id_3 = get_user_agency_id(auth.uid())
);

CREATE POLICY "Users can update their agency suppliers" 
ON public.suppliers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id_1 = get_user_agency_id(auth.uid())
  OR agency_id_2 = get_user_agency_id(auth.uid())
  OR agency_id_3 = get_user_agency_id(auth.uid())
);

CREATE POLICY "Users can delete their agency suppliers" 
ON public.suppliers 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id_1 = get_user_agency_id(auth.uid())
  OR agency_id_2 = get_user_agency_id(auth.uid())
  OR agency_id_3 = get_user_agency_id(auth.uid())
);

-- הוספת policies לטבלת campaigners
CREATE POLICY "Users can view their agency campaigners" 
ON public.campaigners 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

CREATE POLICY "Users can insert their agency campaigners" 
ON public.campaigners 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

CREATE POLICY "Users can update their agency campaigners" 
ON public.campaigners 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);

CREATE POLICY "Users can delete their agency campaigners" 
ON public.campaigners 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR agency_id = get_user_agency_id(auth.uid())
);