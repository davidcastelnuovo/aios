-- Staging verification for save_memory upsert fix (run after migration 20260830120000).
-- Safe to run repeatedly: uses a throwaway key and cleans up.

BEGIN;

-- 1) Insert a fresh instructions row (system scope: user_id NULL)
INSERT INTO public.ai_memory (tenant_id, user_id, category, key, content)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  NULL,
  'instructions',
  '_cursor_verify_save_memory',
  'verify v1'
)
ON CONFLICT (user_id, tenant_id, category, key)
DO UPDATE SET content = EXCLUDED.content, updated_at = now()
RETURNING key, content;

-- 2) Re-upsert same key — must update, not duplicate
INSERT INTO public.ai_memory (tenant_id, user_id, category, key, content)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  NULL,
  'instructions',
  '_cursor_verify_save_memory',
  'verify v2'
)
ON CONFLICT (user_id, tenant_id, category, key)
DO UPDATE SET content = EXCLUDED.content, updated_at = now()
RETURNING key, content;

-- 3) Assert single row remains
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM public.ai_memory
  WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'
    AND category = 'instructions'
    AND key = '_cursor_verify_save_memory';
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'expected 1 ai_memory row after upsert, got %', cnt;
  END IF;
END $$;

-- 4) Cleanup
DELETE FROM public.ai_memory
WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'
  AND key = '_cursor_verify_save_memory';

ROLLBACK; -- remove ROLLBACK to persist test on staging intentionally
