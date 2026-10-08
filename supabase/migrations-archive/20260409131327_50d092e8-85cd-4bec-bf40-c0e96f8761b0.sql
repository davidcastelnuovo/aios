
-- Create ai_skills table for storing Carmen's learned skills
CREATE TABLE public.ai_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  steps TEXT NOT NULL,
  trigger_phrases TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.ai_skills ENABLE ROW LEVEL SECURITY;

-- Users can view their own skills within their tenant
CREATE POLICY "Users can view their own skills"
ON public.ai_skills FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND tenant_id = (SELECT get_effective_tenant_id()));

-- Users can create their own skills
CREATE POLICY "Users can create their own skills"
ON public.ai_skills FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND tenant_id = (SELECT get_effective_tenant_id()));

-- Users can update their own skills
CREATE POLICY "Users can update their own skills"
ON public.ai_skills FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND tenant_id = (SELECT get_effective_tenant_id()));

-- Users can delete their own skills
CREATE POLICY "Users can delete their own skills"
ON public.ai_skills FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND tenant_id = (SELECT get_effective_tenant_id()));

-- Auto-update updated_at
CREATE TRIGGER update_ai_skills_updated_at
BEFORE UPDATE ON public.ai_skills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
