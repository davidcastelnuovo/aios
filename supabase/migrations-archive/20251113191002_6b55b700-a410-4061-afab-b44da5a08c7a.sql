-- Insert default custom fields for client entity
-- These represent the core fixed fields that can have customized labels
INSERT INTO public.custom_fields (tenant_id, entity_type, field_key, field_label, field_type, is_required, is_visible, sort_order)
SELECT 
  t.id,
  'client',
  field.field_key,
  field.field_label,
  field.field_type,
  field.field_required,
  true,
  field.field_sort_order
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('name', 'שם הלקוח', 'text', true, 1),
    ('agency_id', 'סוכנות', 'select', true, 2),
    ('status', 'סטטוס', 'select', true, 3),
    ('is_seo_client', 'לקוח SEO', 'checkbox', false, 4),
    ('retainer', 'ריטיינר', 'number', false, 5),
    ('monthly_budget', 'תקציב חודשי', 'number', false, 6),
    ('phone', 'טלפון', 'text', false, 7),
    ('email', 'אימייל', 'email', false, 8),
    ('website', 'אתר', 'text', false, 9),
    ('folder_link', 'קישור לתיקיה', 'text', false, 10),
    ('campaigners', 'קמפיינרים', 'text', false, 11)
) AS field(field_key, field_label, field_type, field_required, field_sort_order)
ON CONFLICT (tenant_id, entity_type, field_key) DO UPDATE
SET 
  field_label = EXCLUDED.field_label,
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;