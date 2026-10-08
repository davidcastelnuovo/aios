-- Create function to cleanup user_active_tenant when user is removed from tenant
CREATE OR REPLACE FUNCTION cleanup_user_active_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- If user was removed from their active tenant, clean it up
  IF EXISTS (
    SELECT 1 FROM user_active_tenant 
    WHERE user_id = OLD.user_id 
    AND tenant_id = OLD.tenant_id
  ) THEN
    -- Delete the active tenant record
    DELETE FROM user_active_tenant 
    WHERE user_id = OLD.user_id 
    AND tenant_id = OLD.tenant_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on tenant_users DELETE
CREATE TRIGGER trigger_cleanup_user_active_tenant
AFTER DELETE ON tenant_users
FOR EACH ROW
EXECUTE FUNCTION cleanup_user_active_tenant();