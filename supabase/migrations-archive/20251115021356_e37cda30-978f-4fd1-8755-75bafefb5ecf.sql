-- Phase 1: Dynamic Tables Foundation

-- Create crm_tables table
CREATE TABLE IF NOT EXISTS public.crm_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Create crm_fields table
CREATE TABLE IF NOT EXISTS public.crm_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.crm_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'long_text', 'number', 'date', 'datetime', 'checkbox', 'single_select', 'multi_select', 'reference', 'email', 'phone', 'url')),
  position INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(table_id, key)
);

-- Create crm_records table
CREATE TABLE IF NOT EXISTS public.crm_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.crm_tables(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_records_table ON public.crm_records(table_id);
CREATE INDEX IF NOT EXISTS idx_crm_records_tenant ON public.crm_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_records_agency ON public.crm_records(agency_id);
CREATE INDEX IF NOT EXISTS idx_crm_records_data ON public.crm_records USING GIN(data);
CREATE INDEX IF NOT EXISTS idx_crm_tables_tenant ON public.crm_tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_fields_table ON public.crm_fields(table_id);

-- Enable RLS
ALTER TABLE public.crm_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_tables
CREATE POLICY "Users can view tables in their tenant"
  ON public.crm_tables FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Owners can manage tables"
  ON public.crm_tables FOR ALL
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
    OR is_super_admin(auth.uid())
  );

-- RLS Policies for crm_fields
CREATE POLICY "Users can view fields"
  ON public.crm_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_tables 
      WHERE crm_tables.id = crm_fields.table_id 
      AND (crm_tables.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "Owners can manage fields"
  ON public.crm_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_tables 
      WHERE crm_tables.id = crm_fields.table_id 
      AND crm_tables.tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'owner'::app_role) OR is_super_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_tables 
      WHERE crm_tables.id = crm_fields.table_id 
      AND crm_tables.tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'owner'::app_role) OR is_super_admin(auth.uid()))
    )
  );

-- RLS Policies for crm_records
CREATE POLICY "Users can view records in their tenant"
  ON public.crm_records FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view records from shared agencies"
  ON public.crm_records FOR SELECT
  USING (
    agency_id IS NOT NULL 
    AND (user_has_cross_tenant_agency_access(auth.uid(), agency_id) OR is_super_admin(auth.uid()))
  );

CREATE POLICY "Users can manage records in their tenant"
  ON public.crm_records FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Validation function for records
CREATE OR REPLACE FUNCTION public.validate_crm_record(
  p_table_id UUID,
  p_data JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  field RECORD;
  value TEXT;
BEGIN
  -- Check all required fields are present and valid
  FOR field IN 
    SELECT * FROM public.crm_fields 
    WHERE table_id = p_table_id AND is_required = true
  LOOP
    IF NOT p_data ? field.key THEN
      RAISE EXCEPTION 'Required field % is missing', field.key;
    END IF;
    
    -- Basic type validation
    value := p_data->>field.key;
    
    IF value IS NOT NULL AND value != '' THEN
      CASE field.type
        WHEN 'number' THEN
          IF value !~ '^-?[0-9]+\.?[0-9]*$' THEN
            RAISE EXCEPTION 'Field % must be a number', field.key;
          END IF;
        WHEN 'email' THEN
          IF value !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
            RAISE EXCEPTION 'Field % must be a valid email', field.key;
          END IF;
        WHEN 'url' THEN
          IF value !~ '^https?://' THEN
            RAISE EXCEPTION 'Field % must be a valid URL', field.key;
          END IF;
        WHEN 'checkbox' THEN
          IF value NOT IN ('true', 'false') THEN
            RAISE EXCEPTION 'Field % must be a boolean', field.key;
          END IF;
        ELSE
          -- Other types: basic presence check already done
          NULL;
      END CASE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$;

-- Trigger function to validate before insert/update
CREATE OR REPLACE FUNCTION public.trigger_validate_crm_record()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.validate_crm_record(NEW.table_id, NEW.data);
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS validate_crm_record_trigger ON public.crm_records;
CREATE TRIGGER validate_crm_record_trigger
  BEFORE INSERT OR UPDATE ON public.crm_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_validate_crm_record();

-- Trigger for updated_at on crm_tables
CREATE TRIGGER update_crm_tables_updated_at
  BEFORE UPDATE ON public.crm_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on crm_fields
CREATE TRIGGER update_crm_fields_updated_at
  BEFORE UPDATE ON public.crm_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();