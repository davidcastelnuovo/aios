
CREATE OR REPLACE FUNCTION public.mark_all_chats_read(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE chat_messages
  SET read_at = now()
  WHERE tenant_id = p_tenant_id
    AND direction = 'inbound'
    AND read_at IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
