-- save_memory upserts ai_memory with onConflict: 'user_id,tenant_id,category,key'.
-- Migration 20260627210000 replaced the plain UNIQUE constraint with an expression
-- index on COALESCE(user_id, nil_uuid), which Postgres cannot match for ON CONFLICT
-- on the raw columns — every save_memory call failed with
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification".
--
-- Fix: dedupe any rows that accumulated while upserts were broken, then replace the
-- expression index with a NULLS NOT DISTINCT unique index on the same four columns
-- so NULL user_id (system/Carmen writes) still dedupes per tenant/category/key.

-- 1) Dedupe ai_memory — keep the newest row per scope key (no deletes of unique keys).
DELETE FROM public.ai_memory
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), tenant_id, category, key
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM public.ai_memory
  ) ranked
  WHERE rn > 1
);

-- 2) Replace expression unique index with one PostgREST/Supabase can target.
DROP INDEX IF EXISTS public.ai_memory_user_id_tenant_id_category_key_key;

CREATE UNIQUE INDEX ai_memory_user_id_tenant_id_category_key_key
  ON public.ai_memory (user_id, tenant_id, category, key)
  NULLS NOT DISTINCT;

-- 3) agent_memory mirror for save_memory — upsert on stable path per agent.
--    Auto-generated run summaries keep path NULL and are unaffected.
UPDATE public.agent_memory
SET path = 'save_memory/' || category || '/' || (metadata->>'key')
WHERE path IS NULL
  AND metadata->>'source' IN ('save_memory', 'auto_instruction_capture')
  AND NULLIF(metadata->>'key', '') IS NOT NULL;

DELETE FROM public.agent_memory
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY tenant_id, agent_id, path
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM public.agent_memory
    WHERE path IS NOT NULL
      AND path LIKE 'save_memory/%'
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_memory_tenant_agent_path_key
  ON public.agent_memory (tenant_id, agent_id, path);
