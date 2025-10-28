-- Create invitation tokens table
CREATE TABLE public.invitation_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;

-- Only owners and super admins can view invitation tokens
CREATE POLICY "Owners and super admins can view invitation tokens"
ON public.invitation_tokens
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR 
  public.has_role(auth.uid(), 'super_admin')
);

-- Only owners and super admins can create invitation tokens
CREATE POLICY "Owners and super admins can create invitation tokens"
ON public.invitation_tokens
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'owner') OR 
  public.has_role(auth.uid(), 'super_admin')
);

-- Add trigger for updated_at
CREATE TRIGGER update_invitation_tokens_updated_at
BEFORE UPDATE ON public.invitation_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();