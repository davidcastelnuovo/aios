-- Broadcast module v2 — reusable mailing lists, members, and auto-add rules.

-- ─────────────────────────────────────────────────────────────────────────────
-- broadcast_lists — a reusable, named recipient list
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.broadcast_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'static' CHECK (kind IN ('static', 'dynamic')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'google_sheet', 'crm_filter')),
  source_config JSONB NOT NULL DEFAULT '{}'::jsonb,  -- e.g. { sheetId, range, fieldMap }
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blists_tenant ON public.broadcast_lists(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_lists TO authenticated;
GRANT ALL ON public.broadcast_lists TO service_role;
ALTER TABLE public.broadcast_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blists_tenant_select" ON public.broadcast_lists FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "blists_tenant_insert" ON public.broadcast_lists FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "blists_tenant_update" ON public.broadcast_lists FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "blists_tenant_delete" ON public.broadcast_lists FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_blists_updated_at BEFORE UPDATE ON public.broadcast_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- broadcast_list_members — contacts in a list (CRM-linked or free-form imported)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.broadcast_list_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.broadcast_lists(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'manual' CHECK (entity_type IN ('client', 'lead', 'campaigner', 'manual')),
  entity_id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  added_via TEXT NOT NULL DEFAULT 'manual' CHECK (added_via IN ('manual', 'csv', 'sheet', 'rule', 'crm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blmembers_list ON public.broadcast_list_members(list_id);
CREATE INDEX idx_blmembers_tenant ON public.broadcast_list_members(tenant_id);
CREATE UNIQUE INDEX uq_blmembers_phone ON public.broadcast_list_members(list_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX uq_blmembers_email ON public.broadcast_list_members(list_id, email) WHERE email IS NOT NULL AND phone IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_list_members TO authenticated;
GRANT ALL ON public.broadcast_list_members TO service_role;
ALTER TABLE public.broadcast_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blmembers_tenant_select" ON public.broadcast_list_members FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "blmembers_tenant_insert" ON public.broadcast_list_members FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "blmembers_tenant_update" ON public.broadcast_list_members FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "blmembers_tenant_delete" ON public.broadcast_list_members FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- broadcast_list_rules — auto-add incoming leads to a list when they match
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.broadcast_list_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.broadcast_lists(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'lead_created' CHECK (trigger IN ('lead_created')),
  filter JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { statusKeys:[], sources:[] }; empty = all
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blrules_tenant ON public.broadcast_list_rules(tenant_id);
CREATE INDEX idx_blrules_enabled ON public.broadcast_list_rules(trigger) WHERE enabled = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_list_rules TO authenticated;
GRANT ALL ON public.broadcast_list_rules TO service_role;
ALTER TABLE public.broadcast_list_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blrules_tenant_select" ON public.broadcast_list_rules FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "blrules_tenant_insert" ON public.broadcast_list_rules FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "blrules_tenant_update" ON public.broadcast_list_rules FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "blrules_tenant_delete" ON public.broadcast_list_rules FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-add trigger: when a lead is created, add it to lists whose rules match.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_apply_list_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_statuses jsonb;
  v_sources jsonb;
BEGIN
  FOR r IN
    SELECT * FROM public.broadcast_list_rules
    WHERE enabled = true AND trigger = 'lead_created' AND tenant_id = NEW.tenant_id
  LOOP
    v_statuses := COALESCE(r.filter->'statusKeys', '[]'::jsonb);
    v_sources  := COALESCE(r.filter->'sources', '[]'::jsonb);

    -- Skip if a status filter exists and the lead's status is not in it
    IF jsonb_array_length(v_statuses) > 0
       AND NOT (v_statuses ? COALESCE(NEW.status, '')) THEN
      CONTINUE;
    END IF;
    -- Skip if a source filter exists and the lead's source is not in it
    IF jsonb_array_length(v_sources) > 0
       AND NOT (v_sources ? COALESCE(NEW.source::text, '')) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.broadcast_list_members
      (list_id, tenant_id, entity_type, entity_id, name, phone, email, added_via)
    VALUES
      (r.list_id, NEW.tenant_id, 'lead', NEW.id,
       COALESCE(NEW.contact_name, NEW.company_name), NEW.phone, NEW.email, 'rule')
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'broadcast_apply_list_rules failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_broadcast_apply_list_rules
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_apply_list_rules();
