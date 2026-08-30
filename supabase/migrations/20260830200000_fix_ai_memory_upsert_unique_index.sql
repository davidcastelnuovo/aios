-- save_memory upserts ai_memory with
--   onConflict: 'user_id,tenant_id,category,key'
-- Migration 20260627210000 replaced the plain UNIQUE constraint with a
-- COALESCE(user_id, …) expression index so NULL system writes stay unique.
-- PostgreSQL cannot match ON CONFLICT (user_id, …) to that expression index,
-- so every save_memory call failed with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Fix: replace the expression index with NULLS NOT DISTINCT (PG15+) on the
-- raw columns so Supabase upsert inference works and NULL user_id rows still
-- collide correctly per (tenant_id, category, key).

-- ── ai_memory ──────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.ai_memory_user_id_tenant_id_category_key_key;

ALTER TABLE public.ai_memory
  DROP CONSTRAINT IF EXISTS ai_memory_user_id_tenant_id_category_key_key;

-- Keep the newest row when duplicates already exist (safe: upsert intent).
DELETE FROM public.ai_memory a
USING public.ai_memory b
WHERE a.id < b.id
  AND a.tenant_id = b.tenant_id
  AND a.category = b.category
  AND a.key = b.key
  AND a.user_id IS NOT DISTINCT FROM b.user_id;

CREATE UNIQUE INDEX ai_memory_user_id_tenant_id_category_key_key
  ON public.ai_memory (user_id, tenant_id, category, key)
  NULLS NOT DISTINCT;

-- ── agent_memory (save_memory mirror) ───────────────────────────────────────
-- saveAgentMemory mirrors instructions into agent_memory for FTS recall.
-- Without a matching unique index, re-saves duplicate rows.

DROP INDEX IF EXISTS public.agent_memory_instructions_title_unique;

DELETE FROM public.agent_memory a
USING public.agent_memory b
WHERE a.id < b.id
  AND a.tenant_id = b.tenant_id
  AND a.agent_id = b.agent_id
  AND a.category = b.category
  AND a.title = b.title
  AND a.category IN ('instructions', 'instruction');

CREATE UNIQUE INDEX agent_memory_instructions_title_unique
  ON public.agent_memory (tenant_id, agent_id, category, title)
  WHERE category IN ('instructions', 'instruction');
