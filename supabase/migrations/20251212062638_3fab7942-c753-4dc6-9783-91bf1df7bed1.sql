-- Create lead_statuses table for dynamic status management
CREATE TABLE public.lead_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status_key TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#e5e7eb',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, status_key)
);

-- Enable RLS
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view statuses in their tenant"
ON public.lead_statuses FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Owners can manage statuses"
ON public.lead_statuses FOR ALL
USING (
  is_super_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
);

-- Function to initialize default statuses for a tenant
CREATE OR REPLACE FUNCTION public.initialize_tenant_lead_statuses(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.lead_statuses (tenant_id, status_key, label, color, sort_order)
  VALUES
    (_tenant_id, 'no_status', 'ללא סטטוס', '#9ca3af', 0),
    (_tenant_id, 'no_answer_1', 'אין מענה 1', '#fbbf24', 1),
    (_tenant_id, 'no_answer_2', 'אין מענה 2', '#f97316', 2),
    (_tenant_id, 'no_answer_3', 'אין מענה 3', '#ef4444', 3),
    (_tenant_id, 'no_answer_4', 'אין מענה 4', '#dc2626', 4),
    (_tenant_id, 'in_progress', 'בעבודה', '#3b82f6', 5),
    (_tenant_id, 'denies_contact', 'מכחיש פניה', '#8b5cf6', 6),
    (_tenant_id, 'not_relevant', 'לא רלוונטי', '#6b7280', 7)
  ON CONFLICT (tenant_id, status_key) DO NOTHING;
END;
$$;

-- Trigger to auto-initialize statuses for new tenants
CREATE OR REPLACE FUNCTION public.handle_new_tenant_lead_statuses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM initialize_tenant_lead_statuses(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tenant_created_init_lead_statuses
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_tenant_lead_statuses();

-- Initialize statuses for existing tenants
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.initialize_tenant_lead_statuses(t.id);
  END LOOP;
END;
$$;