-- Fix ambiguous RPC resolution for leads kanban
-- Keep canonical overload with p_offset_per_stage at the end
DROP FUNCTION IF EXISTS public.get_leads_by_stages(
  uuid,
  uuid[],
  text[],
  integer,
  integer,
  text,
  timestamp with time zone,
  timestamp with time zone,
  uuid[],
  text[],
  boolean,
  timestamp with time zone,
  timestamp with time zone,
  uuid[]
);