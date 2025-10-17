-- 1) Helper function: assign a role to a user by email (security definer)
create or replace function public.assign_role_by_email(_email text, _role app_role)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
begin
  select id into _user_id from auth.users where email = _email;
  if _user_id is null then
    raise exception 'User with email % not found', _email;
  end if;

  -- optional: ensure the owner role exists alongside others (do not delete existing roles)
  insert into public.user_roles (user_id, role)
  values (_user_id, _role)
  on conflict (user_id, role) do nothing;

  return _user_id;
end;
$$;

-- 2) Grant owners visibility to all tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'Owners can view all tasks'
  ) THEN
    CREATE POLICY "Owners can view all tasks"
    ON public.tasks
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'owner'::app_role));
  END IF;
END
$$;

-- 3) Grant owners visibility to client_team (if needed by UI joins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_team' AND policyname = 'Owners can view all client_team'
  ) THEN
    CREATE POLICY "Owners can view all client_team"
    ON public.client_team
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'owner'::app_role));
  END IF;
END
$$;

-- 4) Assign owner role to the provided email
select public.assign_role_by_email('david.castelnuovo@gmail.com', 'owner'::app_role);