-- Owners (and other elevated roles) who also carry the campaigner role were
-- blocked from reading campaign_pulse_snapshots for clients outside their
-- client_team assignments. The dashboard still listed those clients (broader
-- clients RLS) but showed "ממתין לבדיקת דופק" with no metrics.
-- Align pulse snapshot reads with user_can_access_client, same as CRM tables.

DROP POLICY IF EXISTS "campaign_pulse_snapshots_read" ON public.campaign_pulse_snapshots;

CREATE POLICY "campaign_pulse_snapshots_read"
  ON public.campaign_pulse_snapshots
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin((SELECT auth.uid()))
    OR public.user_can_access_client((SELECT auth.uid()), client_id)
  );

COMMENT ON POLICY "campaign_pulse_snapshots_read" ON public.campaign_pulse_snapshots IS
  'Pulse dashboard reads follow the same client scope as CRM (owners/managers see all tenant clients; pure campaigners only assigned).';
