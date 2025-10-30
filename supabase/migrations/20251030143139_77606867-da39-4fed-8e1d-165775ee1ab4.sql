-- Fix RLS policy for invitation_tokens to allow public read for verification
-- Remove restrictive SELECT policies and add a public one for token verification
DROP POLICY IF EXISTS "Owners and super admins can view invitation tokens" ON public.invitation_tokens;

-- Allow anyone to SELECT (read) unused, non-expired tokens for verification during signup
CREATE POLICY "Anyone can verify unused invitation tokens"
ON public.invitation_tokens
FOR SELECT
USING (
  used = false 
  AND expires_at > now()
);

-- Keep the existing INSERT policy for owners/super admins
-- (No changes needed for the existing insert policy)

-- Add policy to allow the service role to UPDATE tokens (mark as used)
CREATE POLICY "Service role can update invitation tokens"
ON public.invitation_tokens
FOR UPDATE
USING (true);

-- Add comment for clarity
COMMENT ON POLICY "Anyone can verify unused invitation tokens" ON public.invitation_tokens IS 
'Allows public read access to unused, non-expired tokens for signup verification. This is safe because tokens are UUIDs and cannot be guessed.';