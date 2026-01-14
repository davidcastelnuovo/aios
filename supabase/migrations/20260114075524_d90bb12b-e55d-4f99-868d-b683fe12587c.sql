-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own presets" ON public.lead_filter_presets;
DROP POLICY IF EXISTS "Users can view tenant presets" ON public.lead_filter_presets;

-- Create new SELECT policy - all tenant members can see all presets
CREATE POLICY "Users can view tenant presets"
ON public.lead_filter_presets
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Keep UPDATE/DELETE only for the creator
DROP POLICY IF EXISTS "Users can update their own presets" ON public.lead_filter_presets;
DROP POLICY IF EXISTS "Users can delete their own presets" ON public.lead_filter_presets;

CREATE POLICY "Users can update their own presets"
ON public.lead_filter_presets
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own presets"
ON public.lead_filter_presets
FOR DELETE
USING (user_id = auth.uid());