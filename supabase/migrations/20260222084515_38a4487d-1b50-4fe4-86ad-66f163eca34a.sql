
-- Table to store leadgen_ids of deleted Facebook leads
CREATE TABLE public.deleted_facebook_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  leadgen_id text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, leadgen_id)
);

ALTER TABLE public.deleted_facebook_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.deleted_facebook_leads
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger function to record leadgen_id before lead deletion
CREATE OR REPLACE FUNCTION public.track_deleted_facebook_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_leadgen_id text;
BEGIN
  IF OLD.notes IS NOT NULL AND OLD.notes LIKE '%leadgen_id:%' THEN
    v_leadgen_id := trim(split_part(split_part(OLD.notes, 'leadgen_id: ', 2), E'\n', 1));
    IF v_leadgen_id IS NOT NULL AND v_leadgen_id != '' THEN
      INSERT INTO deleted_facebook_leads (tenant_id, leadgen_id)
      VALUES (OLD.tenant_id, v_leadgen_id)
      ON CONFLICT (tenant_id, leadgen_id) DO NOTHING;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_lead_delete_track_facebook
  BEFORE DELETE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.track_deleted_facebook_lead();
