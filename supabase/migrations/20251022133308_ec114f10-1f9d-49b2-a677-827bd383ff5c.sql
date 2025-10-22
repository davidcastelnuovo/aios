-- Simply update any existing agency_owner roles to team_manager
UPDATE public.user_roles 
SET role = 'team_manager' 
WHERE role = 'agency_owner';