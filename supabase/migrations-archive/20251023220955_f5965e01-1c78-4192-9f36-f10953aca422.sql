-- Create enum for lead status
CREATE TYPE public.lead_status AS ENUM (
  'new',
  'contacted',
  'meeting_scheduled',
  'proposal_sent',
  'negotiation',
  'won',
  'lost'
);

-- Create enum for lead source
CREATE TYPE public.lead_source AS ENUM (
  'website',
  'referral',
  'social_media',
  'paid_ads',
  'cold_call',
  'email_campaign',
  'event',
  'other'
);

-- Create sales_people table
CREATE TABLE public.sales_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  notes TEXT,
  folder_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source lead_source NOT NULL DEFAULT 'other',
  status lead_status NOT NULL DEFAULT 'new',
  estimated_deal_value NUMERIC,
  industry TEXT,
  notes TEXT,
  sales_person_id UUID NOT NULL REFERENCES public.sales_people(id) ON DELETE RESTRICT,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  folder_link TEXT,
  lost_reason TEXT,
  won_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_people
CREATE POLICY "Authenticated users can view sales_people"
  ON public.sales_people FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales_people"
  ON public.sales_people FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales_people"
  ON public.sales_people FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete sales_people"
  ON public.sales_people FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for leads
CREATE POLICY "Authenticated users can view leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert leads"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_sales_people_updated_at
  BEFORE UPDATE ON public.sales_people
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_sales_person ON public.leads(sales_person_id);
CREATE INDEX idx_leads_agency ON public.leads(agency_id);
CREATE INDEX idx_sales_people_agency ON public.sales_people(agency_id);