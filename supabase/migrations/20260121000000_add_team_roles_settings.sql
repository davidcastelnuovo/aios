-- הוספת הגדרות תפקידי צוות דינמיים לפי סוג ארגון

-- עדכון ברירות מחדל עבור ארגונים קיימים מסוג organization/root (סוכנויות)
UPDATE public.tenants
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{team_roles}',
  '[
    {"key": "campaigner", "label": "קמפיינר"},
    {"key": "seo", "label": "SEO"},
    {"key": "team_manager", "label": "מנהל צוות"},
    {"key": "content_writer", "label": "כותב תוכן"},
    {"key": "designer", "label": "מעצב גרפי"},
    {"key": "developer", "label": "מפתח"},
    {"key": "social_media", "label": "רשתות חברתיות"}
  ]'::jsonb
)
WHERE org_type IN ('organization', 'root')
  AND (settings->>'team_roles' IS NULL OR settings->'team_roles' = 'null'::jsonb);

-- עדכון ברירות מחדל עבור תת-ארגונים קיימים (עסקים כלליים)
UPDATE public.tenants
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{team_roles}',
  '[
    {"key": "customer_service", "label": "שירות לקוחות"},
    {"key": "account_manager", "label": "מנהל לקוח"},
    {"key": "sales", "label": "מכירות"},
    {"key": "support", "label": "תמיכה טכנית"},
    {"key": "operations", "label": "תפעול"},
    {"key": "team_leader", "label": "ראש צוות"},
    {"key": "specialist", "label": "מומחה"}
  ]'::jsonb
)
WHERE org_type = 'sub_organization'
  AND (settings->>'team_roles' IS NULL OR settings->'team_roles' = 'null'::jsonb);

-- הערה: ארגונים שכבר הגדירו team_roles מותאמים אישית לא ישתנו
COMMENT ON COLUMN public.tenants.settings IS 'הגדרות JSON של הטנט, כולל team_roles - תפקידי צוות מותאמים אישית';
