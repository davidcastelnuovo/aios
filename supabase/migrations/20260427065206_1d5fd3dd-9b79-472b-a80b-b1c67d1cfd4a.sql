-- Allow tenant members to view Carmen WhatsApp sessions in their tenant
CREATE POLICY "Tenant members can view carmen sessions"
ON public.carmen_whatsapp_sessions
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- Allow tenant members to update session status (pause/resume/end)
CREATE POLICY "Tenant members can update carmen sessions"
ON public.carmen_whatsapp_sessions
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);