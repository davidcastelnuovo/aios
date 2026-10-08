-- Drop old restrictive policy that only shows user's own tags
DROP POLICY IF EXISTS "Users can view their own contact tags" ON chat_contact_tags;

-- Create new tenant-based view policy so all tenant users can see tags
CREATE POLICY "Users can view contact tags in their tenant" 
ON chat_contact_tags FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  OR is_super_admin(auth.uid())
);