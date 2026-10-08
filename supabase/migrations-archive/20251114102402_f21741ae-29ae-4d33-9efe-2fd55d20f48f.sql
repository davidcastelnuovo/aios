-- Force types refresh by adding a comment to the user_roles table
COMMENT ON TABLE user_roles IS 'User roles per tenant. Super admin role (with tenant_id = null) is global across all tenants.';

-- Verify tenant_id column exists (this is a no-op but ensures schema is correct)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_roles' AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'tenant_id column is missing from user_roles table';
  END IF;
END $$;