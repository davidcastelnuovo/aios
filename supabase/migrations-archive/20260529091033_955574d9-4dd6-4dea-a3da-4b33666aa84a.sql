
CREATE TABLE public.agent_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'active',
  target_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_goals_agent ON public.agent_goals(agent_id);
CREATE INDEX idx_agent_goals_tenant ON public.agent_goals(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_goals TO authenticated;
GRANT ALL ON public.agent_goals TO service_role;
ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant access agent_goals" ON public.agent_goals
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_agent_goals_updated BEFORE UPDATE ON public.agent_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agent_knowledge_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES public.agent_knowledge_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_akf_agent ON public.agent_knowledge_folders(agent_id);
CREATE INDEX idx_akf_parent ON public.agent_knowledge_folders(parent_folder_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_knowledge_folders TO authenticated;
GRANT ALL ON public.agent_knowledge_folders TO service_role;
ALTER TABLE public.agent_knowledge_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant access agent_knowledge_folders" ON public.agent_knowledge_folders
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TABLE public.agent_knowledge_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.agent_knowledge_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  kind TEXT NOT NULL DEFAULT 'note',
  url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aki_agent ON public.agent_knowledge_items(agent_id);
CREATE INDEX idx_aki_folder ON public.agent_knowledge_items(folder_id);
CREATE INDEX idx_aki_embedding ON public.agent_knowledge_items USING hnsw (embedding vector_cosine_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_knowledge_items TO authenticated;
GRANT ALL ON public.agent_knowledge_items TO service_role;
ALTER TABLE public.agent_knowledge_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant access agent_knowledge_items" ON public.agent_knowledge_items
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_aki_updated BEFORE UPDATE ON public.agent_knowledge_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agent_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'conversation',
  subcategory TEXT,
  path TEXT,
  entity_type TEXT,
  entity_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  summary_embedding vector(1536),
  importance INTEGER NOT NULL DEFAULT 50,
  ref_date DATE,
  valid_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_am_agent ON public.agent_memory(agent_id);
CREATE INDEX idx_am_tenant_agent_category ON public.agent_memory(tenant_id, agent_id, category);
CREATE INDEX idx_am_embedding ON public.agent_memory USING hnsw (summary_embedding vector_cosine_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_memory TO authenticated;
GRANT ALL ON public.agent_memory TO service_role;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant access agent_memory" ON public.agent_memory
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_am_updated BEFORE UPDATE ON public.agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.match_agent_memory(
  p_agent_id UUID,
  p_query_embedding vector(1536),
  p_limit INT DEFAULT 8
) RETURNS TABLE (
  id UUID, title TEXT, summary TEXT, category TEXT, importance INT, similarity FLOAT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.title, m.summary, m.category, m.importance,
         1 - (m.summary_embedding <=> p_query_embedding) AS similarity
  FROM public.agent_memory m
  WHERE m.agent_id = p_agent_id
    AND m.summary_embedding IS NOT NULL
  ORDER BY m.summary_embedding <=> p_query_embedding
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.match_agent_memory(UUID, vector, INT) TO authenticated, service_role;
