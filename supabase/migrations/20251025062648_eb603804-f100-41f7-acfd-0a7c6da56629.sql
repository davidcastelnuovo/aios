-- Create sales_person_agencies junction table (similar to campaigner_agencies)
CREATE TABLE IF NOT EXISTS public.sales_person_agencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_person_id UUID NOT NULL REFERENCES public.sales_people(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sales_person_id, agency_id)
);

-- Enable RLS on sales_person_agencies
ALTER TABLE public.sales_person_agencies ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales_person_agencies
CREATE POLICY "Authenticated users can view sales_person_agencies"
ON public.sales_person_agencies
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert sales_person_agencies"
ON public.sales_person_agencies
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales_person_agencies"
ON public.sales_person_agencies
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete sales_person_agencies"
ON public.sales_person_agencies
FOR DELETE
TO authenticated
USING (true);

-- Create function to get agency IDs for a sales person by user_id
CREATE OR REPLACE FUNCTION public.get_user_sales_person_agency_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT ARRAY_AGG(spa.agency_id)
  FROM public.profiles p
  JOIN public.sales_person_agencies spa ON spa.sales_person_id = p.sales_person_id
  WHERE p.id = _user_id
$$;

-- Migrate existing sales_people agency associations to the new table
INSERT INTO public.sales_person_agencies (sales_person_id, agency_id)
SELECT id, agency_id
FROM public.sales_people
WHERE agency_id IS NOT NULL
ON CONFLICT (sales_person_id, agency_id) DO NOTHING;

-- Update RLS policies on leads table to use the new function for sales people
DROP POLICY IF EXISTS "Sales people can view their leads" ON public.leads;
DROP POLICY IF EXISTS "Sales people can insert their leads" ON public.leads;
DROP POLICY IF EXISTS "Sales people can update their leads" ON public.leads;

CREATE POLICY "Sales people can view leads from their agencies"
ON public.leads
FOR SELECT
TO authenticated
USING (
  sales_person_id = get_user_sales_person_id(auth.uid())
  OR
  agency_id = ANY(get_user_sales_person_agency_ids(auth.uid()))
);

CREATE POLICY "Sales people can insert leads for their agencies"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  sales_person_id = get_user_sales_person_id(auth.uid())
  OR
  agency_id = ANY(get_user_sales_person_agency_ids(auth.uid()))
);

CREATE POLICY "Sales people can update leads from their agencies"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  sales_person_id = get_user_sales_person_id(auth.uid())
  OR
  agency_id = ANY(get_user_sales_person_agency_ids(auth.uid()))
);