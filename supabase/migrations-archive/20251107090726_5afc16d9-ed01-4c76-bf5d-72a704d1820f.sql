-- Create ai_conversations table for AI chatbot
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations in their tenant
CREATE POLICY "Users can view own conversations in their tenant"
ON public.ai_conversations
FOR SELECT
USING (
  (user_id = auth.uid() AND tenant_id = get_user_tenant_id(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
ON public.ai_conversations
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
ON public.ai_conversations
FOR UPDATE
USING (
  user_id = auth.uid() 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
ON public.ai_conversations
FOR DELETE
USING (
  user_id = auth.uid() 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Add trigger for updated_at
CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();