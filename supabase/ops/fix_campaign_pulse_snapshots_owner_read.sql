-- Safe live fix: owners who are also campaigners could not read pulse snapshots
-- for unassigned clients. Run on Staging first, then Production after approval.

DROP POLICY IF EXISTS "campaign_pulse_snapshots_read" ON public.campaign_pulse_snapshots;

CREATE POLICY "campaign_pulse_snapshots_read"
  ON public.campaign_pulse_snapshots
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR public.user_can_access_client((SELECT auth.uid()), client_id)
  );
