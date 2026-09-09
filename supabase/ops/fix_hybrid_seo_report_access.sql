-- Hybrid SEO scope (campaigner.role includes 'SEO') + grant אנה seo app_role.
-- Safe to run on Production and Staging after review.

\ir ../migrations/20260909140000_fix_hybrid_seo_report_access.sql

-- אנה: campaigner.role = {קמפיינר, SEO} but is_seo_staff=false (hybrid).
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT p.id, 'seo'::app_role, '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
FROM public.profiles p
WHERE p.email = 'adamchik2301@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role = 'seo'::app_role
      AND ur.tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
  );

INSERT INTO public.user_permissions (user_id, module, can_access)
SELECT p.id, 'dynamic_tables', true
FROM public.profiles p
WHERE p.email = 'adamchik2301@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = p.id
      AND up.module = 'dynamic_tables'
  );

INSERT INTO public.user_permissions (user_id, module, can_access)
SELECT p.id, 'reports', true
FROM public.profiles p
WHERE p.email = 'adamchik2301@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = p.id
      AND up.module = 'reports'
  );
