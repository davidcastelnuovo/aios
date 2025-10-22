-- Create user permissions table
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all permissions" 
ON public.user_permissions 
FOR SELECT 
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can insert permissions" 
ON public.user_permissions 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can update permissions" 
ON public.user_permissions 
FOR UPDATE 
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can delete permissions" 
ON public.user_permissions 
FOR DELETE 
USING (has_role(auth.uid(), 'owner'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();