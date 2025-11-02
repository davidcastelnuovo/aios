-- Remove the policy that allows campaigners to view clients they are directly assigned to via client_team
-- This ensures campaigners only see clients from their assigned agencies, not individual client assignments
DROP POLICY IF EXISTS "Campaigners can view clients assigned to them" ON public.clients;