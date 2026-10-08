-- Create calendar_shares table for sharing calendar access between users
CREATE TABLE public.calendar_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level text NOT NULL DEFAULT 'full' CHECK (permission_level IN ('view', 'book', 'full')),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(owner_user_id, shared_with_user_id)
);

-- Enable RLS
ALTER TABLE public.calendar_shares ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can see shares where they are the owner or the shared user
CREATE POLICY "Users can view their calendar shares"
  ON public.calendar_shares FOR SELECT
  USING (
    auth.uid() = owner_user_id 
    OR auth.uid() = shared_with_user_id
    OR is_super_admin(auth.uid())
  );

-- Only the owner can insert shares for their calendar
CREATE POLICY "Users can share their own calendar"
  ON public.calendar_shares FOR INSERT
  WITH CHECK (
    auth.uid() = owner_user_id
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

-- Only the owner can update their shares
CREATE POLICY "Users can update their own shares"
  ON public.calendar_shares FOR UPDATE
  USING (auth.uid() = owner_user_id);

-- Only the owner can delete their shares
CREATE POLICY "Users can delete their own shares"
  ON public.calendar_shares FOR DELETE
  USING (auth.uid() = owner_user_id);

-- Create a function to check if a user has calendar access to another user
CREATE OR REPLACE FUNCTION public.user_has_calendar_access(
  _accessor_user_id uuid, 
  _owner_user_id uuid,
  _required_permission text DEFAULT 'view'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- User is accessing their own calendar
    _accessor_user_id = _owner_user_id
    OR
    -- User has been granted access
    EXISTS (
      SELECT 1 FROM public.calendar_shares
      WHERE owner_user_id = _owner_user_id
        AND shared_with_user_id = _accessor_user_id
        AND (
          -- Full access grants everything
          permission_level = 'full'
          OR
          -- Book permission grants view and book
          (permission_level = 'book' AND _required_permission IN ('view', 'book'))
          OR
          -- View permission only grants view
          (permission_level = 'view' AND _required_permission = 'view')
        )
    )
    OR
    -- Super admin has access to everything
    is_super_admin(_accessor_user_id)
$$;

-- Create index for faster lookups
CREATE INDEX idx_calendar_shares_owner ON public.calendar_shares(owner_user_id);
CREATE INDEX idx_calendar_shares_shared_with ON public.calendar_shares(shared_with_user_id);
CREATE INDEX idx_calendar_shares_tenant ON public.calendar_shares(tenant_id);