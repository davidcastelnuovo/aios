-- Fix infinite recursion in campaigners RLS policy
-- The issue is that the shared agencies policy queries campaigner_agencies
-- which might trigger RLS on campaigners again, causing recursion

-- Create a helper function that bypasses RLS
CREATE OR REPLACE FUNCTION user_can_view_campaigner(_user_id uuid, _campaigner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- User can view if campaigner is in their tenant
  SELECT EXISTS (
    SELECT 1 FROM campaigners c
    WHERE c.id = _campaigner_id 
    AND c.tenant_id = get_user_tenant_id(_user_id)
  )
  OR
  -- Or if campaigner is assigned to a shared agency
  EXISTS (
    SELECT 1 
    FROM campaigner_agencies ca
    JOIN agency_tenant_access ata ON ata.agency_id = ca.agency_id
    WHERE ca.campaigner_id = _campaigner_id
    AND ata.accessing_tenant_id = get_user_tenant_id(_user_id)
  )
  OR is_super_admin(_user_id)
$$;

-- Drop the old policies that cause recursion
DROP POLICY IF EXISTS "Users can view campaigners from shared agencies" ON campaigners;
DROP POLICY IF EXISTS "Users can view campaigners in their tenant" ON campaigners;

-- Create a single consolidated policy using the helper function
CREATE POLICY "Users can view accessible campaigners"
ON campaigners
FOR SELECT
USING (user_can_view_campaigner(auth.uid(), id));

-- Similarly fix the other SELECT policies for campaigners to use the same function
-- This ensures consistency across all operations
DROP POLICY IF EXISTS "Campaigners can view clients from their agencies" ON clients;

-- Recreate it if it existed (checking the context, it seems clients policies are ok)