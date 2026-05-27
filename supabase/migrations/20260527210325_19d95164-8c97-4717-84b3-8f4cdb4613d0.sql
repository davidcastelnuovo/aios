
-- HNSW index for semantic search (idempotent)
CREATE INDEX IF NOT EXISTS carmen_memory_pointers_embedding_idx
  ON public.carmen_memory_pointers USING hnsw (summary_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS carmen_memory_episodes_embedding_idx
  ON public.carmen_memory_episodes USING hnsw (summary_embedding vector_cosine_ops);

-- Semantic match RPC for pointers
CREATE OR REPLACE FUNCTION public.kb_match_pointers(
  p_tenant_id uuid,
  p_query_embedding vector(1536),
  p_category text DEFAULT NULL,
  p_since_days int DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  category text,
  subcategory text,
  path text,
  entity_type text,
  entity_id text,
  title text,
  summary text,
  ref_date timestamptz,
  similarity float
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.category, p.subcategory, p.path, p.entity_type, p.entity_id,
         p.title, p.summary, p.ref_date,
         1 - (p.summary_embedding <=> p_query_embedding) AS similarity
  FROM public.carmen_memory_pointers p
  WHERE p.tenant_id = p_tenant_id
    AND p.summary_embedding IS NOT NULL
    AND (p_category IS NULL OR p.category = p_category)
    AND (p_since_days IS NULL OR p.ref_date >= now() - (p_since_days || ' days')::interval)
  ORDER BY p.summary_embedding <=> p_query_embedding
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.kb_match_pointers(uuid, vector, text, int, int) TO authenticated, service_role;

-- Decay helper for episodes (FadeMem-style)
-- retention_score = importance/10 * exp(-lambda * days_since_access)
CREATE OR REPLACE FUNCTION public.carmen_memory_decay_episodes(p_lambda float DEFAULT 0.02)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.carmen_memory_episodes
  SET retention_score = GREATEST(0.0,
        (COALESCE(importance,5)::float / 10.0)
        * exp(-p_lambda * EXTRACT(EPOCH FROM (now() - COALESCE(last_accessed_at, created_at))) / 86400.0)
        * (1.0 + LEAST(2.0, log(GREATEST(1, COALESCE(access_count,0))+1)))
      ),
      updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.carmen_memory_decay_episodes(float) TO service_role;
