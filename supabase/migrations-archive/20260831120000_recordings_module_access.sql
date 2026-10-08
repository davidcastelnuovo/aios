-- Recordings module: ensure schema + grant module permission to operational roles.
-- Symptom in prod: clicking "הקלטות" redirected to my-profile (missing user_permissions row)
-- or the feed query failed when optional agency/folder schema was missing on older prod.

-- Idempotent schema (safe if 20260716200000 / 20260824080000 already applied).
CREATE TABLE IF NOT EXISTS public.recording_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recording_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant access recording_folders" ON public.recording_folders;
CREATE POLICY "tenant access recording_folders" ON public.recording_folders
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_recording_folders_tenant ON public.recording_folders(tenant_id);

ALTER TABLE public.zoom_recordings
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.recording_folders(id) ON DELETE SET NULL;
ALTER TABLE public.zoom_recordings ADD COLUMN IF NOT EXISTS thumbnail_path text;
ALTER TABLE public.zoom_recordings
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_zoom_recordings_folder ON public.zoom_recordings(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zoom_recordings_agency_id ON public.zoom_recordings(agency_id) WHERE agency_id IS NOT NULL;

-- Module permission for team roles that already work in clients/tasks/recordings via RLS.
INSERT INTO public.user_permissions (user_id, module, can_access)
SELECT DISTINCT ur.user_id, 'recordings', true
FROM public.user_roles ur
WHERE ur.role IN (
  'team_manager'::public.app_role,
  'agency_owner'::public.app_role,
  'campaigner'::public.app_role,
  'seo'::public.app_role
)
AND NOT EXISTS (
  SELECT 1
  FROM public.user_permissions up
  WHERE up.user_id = ur.user_id
    AND up.module = 'recordings'
);

UPDATE public.user_permissions up
SET can_access = true, updated_at = now()
FROM public.user_roles ur
WHERE up.user_id = ur.user_id
  AND up.module = 'recordings'
  AND up.can_access = false
  AND ur.role IN (
    'team_manager'::public.app_role,
    'agency_owner'::public.app_role,
    'campaigner'::public.app_role,
    'seo'::public.app_role
  );
