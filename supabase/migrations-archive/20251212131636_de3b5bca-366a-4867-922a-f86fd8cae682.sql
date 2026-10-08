-- Add role terminology entries to all existing tenants
INSERT INTO tenant_terminology (tenant_id, term_key, singular, plural, original_singular, original_plural)
SELECT 
  t.id,
  term.term_key,
  term.singular,
  term.plural,
  term.singular,
  term.plural
FROM tenants t
CROSS JOIN (VALUES 
  ('role_owner', 'בעלים', 'בעלים'),
  ('role_team_manager', 'מנהל צוות', 'מנהלי צוות'),
  ('role_campaigner', 'קמפיינר', 'קמפיינרים'),
  ('role_sales_person', 'איש מכירות', 'אנשי מכירות'),
  ('role_seo', 'SEO', 'SEO'),
  ('role_super_admin', 'סופר אדמין', 'סופר אדמינים')
) AS term(term_key, singular, plural)
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_terminology tt 
  WHERE tt.tenant_id = t.id AND tt.term_key = term.term_key
);