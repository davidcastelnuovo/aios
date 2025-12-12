-- Add task tab terminology entries to all existing tenants
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
  ('task_tab_all', 'כל המשימות', 'כל המשימות'),
  ('task_tab_seo', 'משימות SEO', 'משימות SEO'),
  ('task_tab_campaign', 'משימות קמפיינרים', 'משימות קמפיינרים')
) AS term(term_key, singular, plural)
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_terminology tt 
  WHERE tt.tenant_id = t.id AND tt.term_key = term.term_key
);