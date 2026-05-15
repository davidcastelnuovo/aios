-- Add bidirectional sync fields to calendar_tokens
ALTER TABLE public.calendar_tokens
  ADD COLUMN IF NOT EXISTS watch_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS watch_resource_id TEXT,
  ADD COLUMN IF NOT EXISTS watch_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_sync_token TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT,
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS needs_reconnect BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_calendar_tokens_channel_id ON public.calendar_tokens(watch_channel_id);
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_watch_expires ON public.calendar_tokens(watch_expires_at);