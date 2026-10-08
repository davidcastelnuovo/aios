-- Drop the existing INSERT policy and create one that allows service role inserts
DROP POLICY IF EXISTS "Allow webhook inserts" ON public.ahrefs_reports;
CREATE POLICY "Allow webhook inserts" ON public.ahrefs_reports
  FOR INSERT
  WITH CHECK (true);