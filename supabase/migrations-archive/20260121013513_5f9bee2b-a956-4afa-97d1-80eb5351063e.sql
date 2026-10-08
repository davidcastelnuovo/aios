-- Create function to initialize tenant terminology based on business type
CREATE OR REPLACE FUNCTION public.initialize_tenant_terminology(
  _tenant_id UUID,
  _business_type TEXT DEFAULT 'marketing_agency'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _terms JSONB;
BEGIN
  -- Define terms based on business type
  IF _business_type = 'general_business' THEN
    _terms := '[
      {"key": "agency", "singular": "מחלקה", "plural": "מחלקות", "orig_s": "סוכנות", "orig_p": "סוכנויות"},
      {"key": "client", "singular": "לקוח", "plural": "לקוחות", "orig_s": "לקוח", "orig_p": "לקוחות"},
      {"key": "lead", "singular": "ליד", "plural": "לידים", "orig_s": "ליד", "orig_p": "לידים"},
      {"key": "task", "singular": "משימה", "plural": "משימות", "orig_s": "משימה", "orig_p": "משימות"},
      {"key": "campaigner", "singular": "עובד", "plural": "עובדים", "orig_s": "קמפיינר", "orig_p": "קמפיינרים"},
      {"key": "sales_person", "singular": "איש מכירות", "plural": "אנשי מכירות", "orig_s": "איש מכירות", "orig_p": "אנשי מכירות"},
      {"key": "supplier", "singular": "ספק", "plural": "ספקים", "orig_s": "ספק", "orig_p": "ספקים"},
      {"key": "product", "singular": "מוצר", "plural": "מוצרים", "orig_s": "מוצר", "orig_p": "מוצרים"},
      {"key": "onboarding", "singular": "קליטה", "plural": "קליטות", "orig_s": "קליטה", "orig_p": "קליטות"},
      {"key": "role_owner", "singular": "בעלים", "plural": "בעלים", "orig_s": "בעלים", "orig_p": "בעלים"},
      {"key": "role_team_manager", "singular": "מנהל", "plural": "מנהלים", "orig_s": "מנהל צוות", "orig_p": "מנהלי צוות"},
      {"key": "role_campaigner", "singular": "עובד", "plural": "עובדים", "orig_s": "קמפיינר", "orig_p": "קמפיינרים"},
      {"key": "role_sales_person", "singular": "איש מכירות", "plural": "אנשי מכירות", "orig_s": "איש מכירות", "orig_p": "אנשי מכירות"},
      {"key": "role_seo", "singular": "מנהל פרויקט", "plural": "מנהלי פרויקטים", "orig_s": "SEO", "orig_p": "SEO"},
      {"key": "role_super_admin", "singular": "מנהל מערכת", "plural": "מנהלי מערכת", "orig_s": "סופר אדמין", "orig_p": "סופר אדמינים"},
      {"key": "task_tab_all", "singular": "כל המשימות", "plural": "כל המשימות", "orig_s": "כל המשימות", "orig_p": "כל המשימות"},
      {"key": "task_tab_seo", "singular": "משימות פרויקט", "plural": "משימות פרויקט", "orig_s": "משימות ללקוחות", "orig_p": "משימות ללקוחות"},
      {"key": "task_tab_campaign", "singular": "משימות כלליות", "plural": "משימות כלליות", "orig_s": "משימות ללידים", "orig_p": "משימות ללידים"}
    ]'::JSONB;
  ELSE
    -- Default marketing agency terminology
    _terms := '[
      {"key": "agency", "singular": "סוכנות", "plural": "סוכנויות", "orig_s": "סוכנות", "orig_p": "סוכנויות"},
      {"key": "client", "singular": "לקוח", "plural": "לקוחות", "orig_s": "לקוח", "orig_p": "לקוחות"},
      {"key": "lead", "singular": "ליד", "plural": "לידים", "orig_s": "ליד", "orig_p": "לידים"},
      {"key": "task", "singular": "משימה", "plural": "משימות", "orig_s": "משימה", "orig_p": "משימות"},
      {"key": "campaigner", "singular": "קמפיינר", "plural": "קמפיינרים", "orig_s": "קמפיינר", "orig_p": "קמפיינרים"},
      {"key": "sales_person", "singular": "איש מכירות", "plural": "אנשי מכירות", "orig_s": "איש מכירות", "orig_p": "אנשי מכירות"},
      {"key": "supplier", "singular": "ספק", "plural": "ספקים", "orig_s": "ספק", "orig_p": "ספקים"},
      {"key": "product", "singular": "מוצר", "plural": "מוצרים", "orig_s": "מוצר", "orig_p": "מוצרים"},
      {"key": "onboarding", "singular": "קליטה", "plural": "קליטות", "orig_s": "קליטה", "orig_p": "קליטות"},
      {"key": "role_owner", "singular": "בעלים", "plural": "בעלים", "orig_s": "בעלים", "orig_p": "בעלים"},
      {"key": "role_team_manager", "singular": "מנהל צוות", "plural": "מנהלי צוות", "orig_s": "מנהל צוות", "orig_p": "מנהלי צוות"},
      {"key": "role_campaigner", "singular": "קמפיינר", "plural": "קמפיינרים", "orig_s": "קמפיינר", "orig_p": "קמפיינרים"},
      {"key": "role_sales_person", "singular": "איש מכירות", "plural": "אנשי מכירות", "orig_s": "איש מכירות", "orig_p": "אנשי מכירות"},
      {"key": "role_seo", "singular": "SEO", "plural": "SEO", "orig_s": "SEO", "orig_p": "SEO"},
      {"key": "role_super_admin", "singular": "סופר אדמין", "plural": "סופר אדמינים", "orig_s": "סופר אדמין", "orig_p": "סופר אדמינים"},
      {"key": "task_tab_all", "singular": "כל המשימות", "plural": "כל המשימות", "orig_s": "כל המשימות", "orig_p": "כל המשימות"},
      {"key": "task_tab_seo", "singular": "משימות ללקוחות", "plural": "משימות ללקוחות", "orig_s": "משימות ללקוחות", "orig_p": "משימות ללקוחות"},
      {"key": "task_tab_campaign", "singular": "משימות ללידים", "plural": "משימות ללידים", "orig_s": "משימות ללידים", "orig_p": "משימות ללידים"}
    ]'::JSONB;
  END IF;

  -- Insert terminology
  INSERT INTO tenant_terminology (tenant_id, term_key, singular, plural, original_singular, original_plural)
  SELECT 
    _tenant_id,
    term->>'key',
    term->>'singular',
    term->>'plural',
    term->>'orig_s',
    term->>'orig_p'
  FROM jsonb_array_elements(_terms) AS term
  ON CONFLICT (tenant_id, term_key) DO NOTHING;
END;
$$;