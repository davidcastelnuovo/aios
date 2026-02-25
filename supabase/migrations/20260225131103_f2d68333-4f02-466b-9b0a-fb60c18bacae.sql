
-- Create zoom_recordings table
CREATE TABLE public.zoom_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meeting_id TEXT NOT NULL,
  meeting_topic TEXT,
  host_email TEXT,
  start_time TIMESTAMPTZ,
  duration INTEGER,
  recording_url TEXT,
  recording_password TEXT,
  recording_type TEXT,
  file_size BIGINT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zoom_recordings ENABLE ROW LEVEL SECURITY;

-- RLS policies with tenant isolation
CREATE POLICY "Users can view zoom recordings in their tenant"
  ON public.zoom_recordings FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert zoom recordings in their tenant"
  ON public.zoom_recordings FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update zoom recordings in their tenant"
  ON public.zoom_recordings FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete zoom recordings in their tenant"
  ON public.zoom_recordings FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Allow service role (edge function) to insert without auth
CREATE POLICY "Service role can insert zoom recordings"
  ON public.zoom_recordings FOR INSERT
  WITH CHECK (true);

-- Index for tenant queries
CREATE INDEX idx_zoom_recordings_tenant_id ON public.zoom_recordings(tenant_id);
CREATE INDEX idx_zoom_recordings_meeting_id ON public.zoom_recordings(meeting_id);
