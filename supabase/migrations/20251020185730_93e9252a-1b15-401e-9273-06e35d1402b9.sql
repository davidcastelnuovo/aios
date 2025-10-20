-- Create enum for client onboarding status
CREATE TYPE public.onboarding_status AS ENUM (
  'research_meeting',
  'receiving_access',
  'setup_and_content',
  'campaign_live'
);

-- Update client_status enum to include onboarding status
ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'onboarding';

-- Create client_onboarding table
CREATE TABLE public.client_onboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  campaigner_id UUID NOT NULL REFERENCES public.campaigners(id),
  agency_id UUID NOT NULL REFERENCES public.agencies(id),
  status onboarding_status NOT NULL DEFAULT 'research_meeting',
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_onboarding
CREATE POLICY "Admins can view all onboarding"
ON public.client_onboarding
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can view all onboarding"
ON public.client_onboarding
FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Users can view their assigned onboarding"
ON public.client_onboarding
FOR SELECT
USING (campaigner_id = get_user_campaigner_id(auth.uid()));

CREATE POLICY "Users can insert their own onboarding"
ON public.client_onboarding
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'owner'::app_role) OR 
  (campaigner_id = get_user_campaigner_id(auth.uid()))
);

CREATE POLICY "Users can update their assigned onboarding"
ON public.client_onboarding
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'owner'::app_role) OR 
  (campaigner_id = get_user_campaigner_id(auth.uid()))
);

CREATE POLICY "Users can delete their assigned onboarding"
ON public.client_onboarding
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'owner'::app_role) OR 
  (campaigner_id = get_user_campaigner_id(auth.uid()))
);

-- Create trigger for updated_at
CREATE TRIGGER update_client_onboarding_updated_at
BEFORE UPDATE ON public.client_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update client status when onboarding reaches campaign_live
CREATE OR REPLACE FUNCTION public.handle_onboarding_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When status changes to campaign_live, update client status to active
  IF NEW.status = 'campaign_live' AND (OLD.status IS NULL OR OLD.status != 'campaign_live') THEN
    UPDATE public.clients
    SET status = 'active'
    WHERE id = NEW.client_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update client status
CREATE TRIGGER on_onboarding_completion
AFTER INSERT OR UPDATE ON public.client_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.handle_onboarding_completion();