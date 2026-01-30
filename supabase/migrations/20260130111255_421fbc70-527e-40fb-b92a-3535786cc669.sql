
-- Drop old policy that only checks direct sales_person_id
DROP POLICY IF EXISTS "Sales people view assigned leads" ON leads;

-- Create new policy that checks lead_sales_people junction table
CREATE POLICY "Sales people view assigned leads" ON leads
FOR SELECT
USING (
  has_role(auth.uid(), 'sales_person'::app_role)
  AND tenant_id = get_user_tenant_id(auth.uid())
  AND EXISTS (
    SELECT 1 
    FROM lead_sales_people lsp
    WHERE lsp.lead_id = leads.id
      AND lsp.tenant_id = leads.tenant_id
      AND lsp.sales_person_id = get_user_sales_person_id(auth.uid())
  )
);
