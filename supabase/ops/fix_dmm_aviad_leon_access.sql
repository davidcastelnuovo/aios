-- Link aviiadco@gmail.com to DMM campaigner אביעד (10 DMM-LTD clients).
-- Marlog אביעד record has zero client assignments, so repointing profile is safe.

INSERT INTO public.tenant_users (user_id, tenant_id, role)
VALUES ('360c03dd-f741-4b27-a57c-44f80e5c243e', '6ad8f321-25db-4a04-8e44-e57a7c8961b2', 'campaigner')
ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES ('360c03dd-f741-4b27-a57c-44f80e5c243e', 'campaigner', '6ad8f321-25db-4a04-8e44-e57a7c8961b2')
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

UPDATE public.profiles
SET campaigner_id = 'c906c4e4-f97d-4003-a314-b5221337129a'
WHERE id = '360c03dd-f741-4b27-a57c-44f80e5c243e';

UPDATE public.campaigners
SET email = 'aviiadco@gmail.com'
WHERE id = 'c906c4e4-f97d-4003-a314-b5221337129a';

INSERT INTO public.user_permissions (user_id, module, can_access)
SELECT '360c03dd-f741-4b27-a57c-44f80e5c243e', module_name, true
FROM (VALUES
  ('dashboard'),
  ('clients'),
  ('tasks'),
  ('chat'),
  ('time_tracking'),
  ('dynamic_tables'),
  ('reports')
) AS modules(module_name)
ON CONFLICT DO NOTHING;

UPDATE public.user_permissions
SET can_access = true
WHERE user_id = '360c03dd-f741-4b27-a57c-44f80e5c243e'
  AND module IN ('dashboard', 'clients', 'tasks', 'chat', 'time_tracking', 'dynamic_tables', 'reports')
  AND can_access = false;

-- לאון: enable modules that were explicitly denied
UPDATE public.user_permissions
SET can_access = true
WHERE user_id = 'be7c9b1c-7682-4cee-bb55-51d01a5a1ed4'
  AND module IN ('dashboard', 'dynamic_tables', 'reports', 'chat');

INSERT INTO public.user_permissions (user_id, module, can_access)
SELECT 'be7c9b1c-7682-4cee-bb55-51d01a5a1ed4', module_name, true
FROM (VALUES ('dashboard'), ('dynamic_tables'), ('reports'), ('chat')) AS modules(module_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permissions up
  WHERE up.user_id = 'be7c9b1c-7682-4cee-bb55-51d01a5a1ed4'
    AND up.module = modules.module_name
);

INSERT INTO public.claude_carmen_audit (actor, action, target, details)
VALUES (
  'claude',
  'campaigner_access_repair',
  'tenant:dmm',
  jsonb_build_object(
    'users', jsonb_build_array('aviiadco@gmail.com', 'i@inmarket.co.il'),
    'note', 'Linked אביעד to DMM; enabled לאון report/dashboard permissions'
  )
);
