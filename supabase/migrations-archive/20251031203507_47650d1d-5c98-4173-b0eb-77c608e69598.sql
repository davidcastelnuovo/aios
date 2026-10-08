-- Create table for lead updates
CREATE TABLE public.lead_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_updates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create lead updates"
ON public.lead_updates
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  lead_id IN (
    SELECT l.id FROM leads l
    WHERE (l.agency_id = ANY (get_user_agency_ids(auth.uid())))
      OR has_role(auth.uid(), 'owner'::app_role)
      OR (l.agency_id = ANY (get_user_sales_person_agency_ids(auth.uid())))
  )
);

CREATE POLICY "Users can view lead updates"
ON public.lead_updates
FOR SELECT
USING (
  lead_id IN (
    SELECT l.id FROM leads l
    WHERE (l.agency_id = ANY (get_user_agency_ids(auth.uid())))
      OR has_role(auth.uid(), 'owner'::app_role)
      OR (l.agency_id = ANY (get_user_sales_person_agency_ids(auth.uid())))
  )
);

CREATE POLICY "Users can update own lead updates"
ON public.lead_updates
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lead updates"
ON public.lead_updates
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_lead_updates_updated_at
BEFORE UPDATE ON public.lead_updates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_lead_updates_lead_id ON public.lead_updates(lead_id);
CREATE INDEX idx_lead_updates_user_id ON public.lead_updates(user_id);