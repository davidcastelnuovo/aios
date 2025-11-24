-- Remove remaining duplicate SELECT policies

-- CAMPAIGNERS: Keep only "Users can view campaigners in accessible tenants"
DROP POLICY IF EXISTS "Users can view accessible campaigners" ON public.campaigners;

-- CLIENTS: Simplify - keep role-specific and accessible tenants policies
-- Remove the redundant ones
DROP POLICY IF EXISTS "Owners can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view clients from shared agencies" ON public.clients;