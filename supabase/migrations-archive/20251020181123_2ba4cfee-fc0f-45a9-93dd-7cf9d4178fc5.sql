-- Create time_entries table for tracking work hours
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaigner_id UUID NOT NULL REFERENCES public.campaigners(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own time entries
CREATE POLICY "Users can view their own time entries"
ON public.time_entries
FOR SELECT
USING (campaigner_id = get_user_campaigner_id(auth.uid()));

-- Admins and owners can view all time entries
CREATE POLICY "Admins can view all time entries"
ON public.time_entries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can view all time entries"
ON public.time_entries
FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role));

-- Users can insert their own time entries
CREATE POLICY "Users can insert their own time entries"
ON public.time_entries
FOR INSERT
WITH CHECK (campaigner_id = get_user_campaigner_id(auth.uid()));

-- Users can update their own time entries
CREATE POLICY "Users can update their own time entries"
ON public.time_entries
FOR UPDATE
USING (campaigner_id = get_user_campaigner_id(auth.uid()));

-- Admins and owners can update all time entries
CREATE POLICY "Admins can update all time entries"
ON public.time_entries
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can update all time entries"
ON public.time_entries
FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role));

-- Users can delete their own time entries
CREATE POLICY "Users can delete their own time entries"
ON public.time_entries
FOR DELETE
USING (campaigner_id = get_user_campaigner_id(auth.uid()));

-- Admins and owners can delete all time entries
CREATE POLICY "Admins can delete all time entries"
ON public.time_entries
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can delete all time entries"
ON public.time_entries
FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();