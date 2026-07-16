-- Recordings feed redesign: named folders (e.g. "הדרכות מערכת") + thumbnails.
-- Per-client "folders" are virtual (derived from zoom_recordings.client_id);
-- this table holds only the custom general-purpose folders.
CREATE TABLE IF NOT EXISTS public.recording_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recording_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant access recording_folders" ON public.recording_folders
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_recording_folders_tenant ON public.recording_folders(tenant_id);

ALTER TABLE public.zoom_recordings
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.recording_folders(id) ON DELETE SET NULL;
ALTER TABLE public.zoom_recordings ADD COLUMN IF NOT EXISTS thumbnail_path text;

CREATE INDEX IF NOT EXISTS idx_zoom_recordings_folder ON public.zoom_recordings(folder_id) WHERE folder_id IS NOT NULL;
