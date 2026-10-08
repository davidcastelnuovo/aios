-- Carmen meeting bot (Recall.ai): join Zoom / Google Meet / Teams, record + transcribe.
CREATE TABLE IF NOT EXISTS public.meeting_bot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  meeting_url text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('zoom', 'google_meet', 'teams', 'unknown')),
  meeting_topic text,
  provider text NOT NULL DEFAULT 'recall',
  external_bot_id text,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN (
      'scheduled', 'joining', 'waiting_room', 'in_meeting', 'processing', 'done', 'failed', 'cancelled'
    )),
  status_detail text,
  zoom_recording_id uuid REFERENCES public.zoom_recordings(id) ON DELETE SET NULL,
  calendar_event_id text,
  scheduled_start timestamptz,
  joined_at timestamptz,
  ended_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_bot_sessions_tenant ON public.meeting_bot_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meeting_bot_sessions_status ON public.meeting_bot_sessions(tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_bot_sessions_external_bot
  ON public.meeting_bot_sessions(external_bot_id) WHERE external_bot_id IS NOT NULL;

ALTER TABLE public.meeting_bot_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view meeting bot sessions in their tenant" ON public.meeting_bot_sessions;
CREATE POLICY "Users can view meeting bot sessions in their tenant" ON public.meeting_bot_sessions
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert meeting bot sessions in their tenant" ON public.meeting_bot_sessions;
CREATE POLICY "Users can insert meeting bot sessions in their tenant" ON public.meeting_bot_sessions
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update meeting bot sessions in their tenant" ON public.meeting_bot_sessions;
CREATE POLICY "Users can update meeting bot sessions in their tenant" ON public.meeting_bot_sessions
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.meeting_bot_sessions IS
  'Tracks Recall.ai (or other) meeting bots dispatched as Carmen — Zoom, Google Meet, Teams.';
