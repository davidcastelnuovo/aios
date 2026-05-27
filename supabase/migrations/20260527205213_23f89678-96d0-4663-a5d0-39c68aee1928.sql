
-- Enable pgvector for semantic search on summaries
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. carmen_memory_pointers — hierarchical knowledge index
-- ============================================================
CREATE TABLE public.carmen_memory_pointers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  category      TEXT NOT NULL,          -- clients | team | messages | conversations | system_map
  subcategory   TEXT,                   -- reports | updates | communications | tasks | assigned_clients | etc.
  path          TEXT NOT NULL,          -- e.g. clients/<uuid>/reports
  entity_type   TEXT,                   -- client | campaigner | chat_message | task | ai_conversation | table
  entity_id     TEXT,                   -- pointer to source row (text to support non-uuid ids like table names)
  title         TEXT NOT NULL,
  summary       TEXT,
  summary_embedding vector(1536),
  ref_date      TIMESTAMPTZ,
  valid_from    TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until   TIMESTAMPTZ,
  importance    SMALLINT NOT NULL DEFAULT 50,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, path, entity_type, entity_id, subcategory)
);

CREATE INDEX idx_cmp_tenant_path ON public.carmen_memory_pointers (tenant_id, path);
CREATE INDEX idx_cmp_tenant_cat ON public.carmen_memory_pointers (tenant_id, category, subcategory);
CREATE INDEX idx_cmp_entity ON public.carmen_memory_pointers (entity_type, entity_id);
CREATE INDEX idx_cmp_refdate ON public.carmen_memory_pointers (tenant_id, ref_date DESC);
CREATE INDEX idx_cmp_metadata ON public.carmen_memory_pointers USING GIN (metadata);
CREATE INDEX idx_cmp_active ON public.carmen_memory_pointers (tenant_id, path) WHERE valid_until IS NULL;

GRANT SELECT ON public.carmen_memory_pointers TO authenticated;
GRANT ALL ON public.carmen_memory_pointers TO service_role;

ALTER TABLE public.carmen_memory_pointers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cmp_select_tenant" ON public.carmen_memory_pointers
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- ============================================================
-- 2. carmen_memory_episodes — conversation summaries
-- ============================================================
CREATE TABLE public.carmen_memory_episodes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL,
  session_ref        TEXT,                          -- conversation id / session key
  topic              TEXT,
  topic_tags         TEXT[] DEFAULT '{}',
  summary            TEXT NOT NULL,
  summary_embedding  vector(1536),
  source_table       TEXT,                          -- e.g. chat_messages | ai_conversations
  source_ids         TEXT[] DEFAULT '{}',           -- pointers to source rows
  participants       JSONB DEFAULT '[]'::jsonb,     -- [{type,id,name}]
  importance         SMALLINT NOT NULL DEFAULT 50,
  retention_score    REAL NOT NULL DEFAULT 1.0,
  ref_date           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_count       INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cme_tenant_date ON public.carmen_memory_episodes (tenant_id, ref_date DESC);
CREATE INDEX idx_cme_session ON public.carmen_memory_episodes (tenant_id, session_ref);
CREATE INDEX idx_cme_topic ON public.carmen_memory_episodes USING GIN (topic_tags);
CREATE INDEX idx_cme_retention ON public.carmen_memory_episodes (tenant_id, retention_score);

GRANT SELECT ON public.carmen_memory_episodes TO authenticated;
GRANT ALL ON public.carmen_memory_episodes TO service_role;

ALTER TABLE public.carmen_memory_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cme_select_tenant" ON public.carmen_memory_episodes
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- ============================================================
-- 3. carmen_memory_outbox — async sync queue
-- ============================================================
CREATE TABLE public.carmen_memory_outbox (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     UUID,
  entity_type   TEXT NOT NULL,                   -- client | chat_message | task | ai_conversation | campaigner | ahrefs_report
  entity_id     TEXT NOT NULL,
  op            TEXT NOT NULL,                   -- insert | update | delete
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at  TIMESTAMPTZ,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cmo_unprocessed ON public.carmen_memory_outbox (created_at) WHERE processed_at IS NULL;
CREATE INDEX idx_cmo_tenant ON public.carmen_memory_outbox (tenant_id);

GRANT ALL ON public.carmen_memory_outbox TO service_role;

ALTER TABLE public.carmen_memory_outbox ENABLE ROW LEVEL SECURITY;
-- no policies for authenticated — only service role uses this queue

-- ============================================================
-- Outbox trigger functions (lightweight, only INSERT into outbox)
-- ============================================================
CREATE OR REPLACE FUNCTION public.carmen_outbox_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type TEXT := TG_ARGV[0];
  v_op TEXT;
  v_tenant_id UUID;
  v_entity_id TEXT;
  v_payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_op := 'delete';
    v_entity_id := COALESCE((OLD.id)::text, '');
    v_tenant_id := (OLD.tenant_id);
    v_payload := to_jsonb(OLD);
  ELSE
    v_op := lower(TG_OP);
    v_entity_id := COALESCE((NEW.id)::text, '');
    v_tenant_id := (NEW.tenant_id);
    v_payload := to_jsonb(NEW);
  END IF;

  INSERT INTO public.carmen_memory_outbox (tenant_id, entity_type, entity_id, op, payload)
  VALUES (v_tenant_id, v_entity_type, v_entity_id, v_op, v_payload);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Triggers on source-of-truth tables (lightweight, write-only to outbox)
CREATE TRIGGER carmen_kb_clients_outbox
AFTER INSERT OR UPDATE OR DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.carmen_outbox_enqueue('client');

CREATE TRIGGER carmen_kb_campaigners_outbox
AFTER INSERT OR UPDATE OR DELETE ON public.campaigners
FOR EACH ROW EXECUTE FUNCTION public.carmen_outbox_enqueue('campaigner');

CREATE TRIGGER carmen_kb_tasks_outbox
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.carmen_outbox_enqueue('task');

CREATE TRIGGER carmen_kb_chat_messages_outbox
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.carmen_outbox_enqueue('chat_message');

CREATE TRIGGER carmen_kb_ai_conversations_outbox
AFTER INSERT OR UPDATE ON public.ai_conversations
FOR EACH ROW EXECUTE FUNCTION public.carmen_outbox_enqueue('ai_conversation');

-- updated_at trigger for pointers
CREATE TRIGGER carmen_memory_pointers_updated_at
BEFORE UPDATE ON public.carmen_memory_pointers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER carmen_memory_episodes_updated_at
BEFORE UPDATE ON public.carmen_memory_episodes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
