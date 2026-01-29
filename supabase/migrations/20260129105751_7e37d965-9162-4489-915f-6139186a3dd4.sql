-- Create sync_jobs table for background job processing
CREATE TABLE public.sync_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'manychat_sync',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'stopped', 'failed')),
  progress JSONB NOT NULL DEFAULT '{"processed": 0, "failed": 0, "remaining": 0, "conflicts": 0, "results": []}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_sync_jobs_tenant_status ON public.sync_jobs(tenant_id, status);
CREATE INDEX idx_sync_jobs_created_at ON public.sync_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sync jobs in their tenant"
ON public.sync_jobs FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can create sync jobs in their tenant"
ON public.sync_jobs FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can update sync jobs in their tenant"
ON public.sync_jobs FOR UPDATE
USING (
  is_super_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id(auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_sync_jobs_updated_at
  BEFORE UPDATE ON public.sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_messages_updated_at();

-- Enable realtime for sync_jobs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;