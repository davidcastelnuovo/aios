-- Backfill campaigners.email from profiles.email where empty
UPDATE public.campaigners c
SET email = p.email,
    updated_at = now()
FROM public.profiles p
WHERE p.campaigner_id = c.id
  AND (c.email IS NULL OR c.email = '')
  AND p.email IS NOT NULL
  AND p.email != '';

-- Backfill campaigners.full_name from profiles.full_name where empty
UPDATE public.campaigners c
SET full_name = p.full_name,
    updated_at = now()
FROM public.profiles p
WHERE p.campaigner_id = c.id
  AND (c.full_name IS NULL OR c.full_name = '' OR c.full_name = 'קמפיינר')
  AND p.full_name IS NOT NULL
  AND p.full_name != '';

-- Backfill sales_people.email from profiles.email where empty
UPDATE public.sales_people sp
SET email = p.email,
    updated_at = now()
FROM public.profiles p
WHERE p.sales_person_id = sp.id
  AND (sp.email IS NULL OR sp.email = '')
  AND p.email IS NOT NULL
  AND p.email != '';

-- Backfill sales_people.full_name from profiles.full_name where empty
UPDATE public.sales_people sp
SET full_name = p.full_name,
    updated_at = now()
FROM public.profiles p
WHERE p.sales_person_id = sp.id
  AND (sp.full_name IS NULL OR sp.full_name = '' OR sp.full_name = 'איש מכירות')
  AND p.full_name IS NOT NULL
  AND p.full_name != '';