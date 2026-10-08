
-- Drop the overly permissive service role policy and replace with a more specific one
DROP POLICY "Service role can insert zoom recordings" ON public.zoom_recordings;

-- The edge function uses service_role key which bypasses RLS entirely,
-- so we don't need a special policy for it. The existing tenant-scoped policies are sufficient.
