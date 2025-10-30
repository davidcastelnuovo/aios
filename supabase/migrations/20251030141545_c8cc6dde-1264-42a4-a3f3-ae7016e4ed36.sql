-- Allow service role to insert into tenant_users (for invitation signup)
CREATE POLICY "Service role can insert tenant_users"
ON public.tenant_users
FOR INSERT
TO service_role
WITH CHECK (true);