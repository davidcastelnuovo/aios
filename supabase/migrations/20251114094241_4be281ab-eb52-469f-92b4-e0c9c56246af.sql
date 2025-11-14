-- הוספת enum לסוגי ארגונים
CREATE TYPE public.org_type AS ENUM ('root', 'organization', 'sub_organization');

-- הוספת עמודת org_type לטבלת tenants
ALTER TABLE public.tenants 
ADD COLUMN org_type public.org_type NOT NULL DEFAULT 'organization';

-- עדכון ארגון MarketingCaptain להיות root
UPDATE public.tenants 
SET org_type = 'root' 
WHERE slug = 'marketingcaptain';

-- עדכון כל ארגון ללא parent להיות root (למקרה שיש עוד)
UPDATE public.tenants 
SET org_type = 'root' 
WHERE parent_tenant_id IS NULL AND org_type != 'root';

-- הוספת constraint: תת-ארגון חייב להיות עם parent
ALTER TABLE public.tenants
ADD CONSTRAINT sub_org_must_have_parent 
CHECK (
  (org_type != 'sub_organization') OR 
  (org_type = 'sub_organization' AND parent_tenant_id IS NOT NULL)
);

-- הוספת index לשיפור ביצועים
CREATE INDEX idx_tenants_org_type ON public.tenants(org_type);
CREATE INDEX idx_tenants_parent_tenant_id ON public.tenants(parent_tenant_id);