-- Seed default lead pipeline stages for any tenant that currently has none.
-- This is required for Kanban/RPC-based lead retrieval which depends on lead_pipeline_stages.
WITH target_tenants AS (
  SELECT t.id AS tenant_id
  FROM public.tenants t
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.lead_pipeline_stages s
    WHERE s.tenant_id = t.id
  )
)
INSERT INTO public.lead_pipeline_stages (
  tenant_id,
  stage_key,
  label,
  color,
  sort_order,
  is_active,
  created_at,
  updated_at
)
SELECT
  tt.tenant_id,
  v.stage_key,
  v.label,
  v.color,
  v.sort_order,
  true,
  now(),
  now()
FROM target_tenants tt
CROSS JOIN (
  VALUES
    ('new', 'חדש', '#3b82f6', 10),
    ('contacted', 'יצרנו קשר', '#a855f7', 20),
    ('meeting_scheduled', 'נקבעה פגישה', '#eab308', 30),
    ('proposal_sent', 'נשלחה הצעה', '#f97316', 40),
    ('negotiation', 'משא ומתן', '#22c55e', 50),
    ('closed', 'נסגר', '#10b981', 60)
) AS v(stage_key, label, color, sort_order);
