-- Manual verification for 20260830200000_fix_ai_memory_upsert_unique_index.sql
-- Run against Staging after migration apply (service role or psql).

-- 1) Confirm the ai_memory index exists and is not expression-based
SELECT indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'ai_memory'
  AND indexname = 'ai_memory_user_id_tenant_id_category_key_key';

-- 2) Upsert new instruction (system user_id = NULL)
INSERT INTO public.ai_memory (tenant_id, user_id, category, key, content)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  NULL,
  'instructions',
  'cursor_test_save_memory_key',
  'First version'
)
ON CONFLICT (user_id, tenant_id, category, key)
DO UPDATE SET content = EXCLUDED.content, updated_at = now()
RETURNING key, content, user_id;

-- 3) Re-upsert same key — must update, not duplicate
INSERT INTO public.ai_memory (tenant_id, user_id, category, key, content)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  NULL,
  'instructions',
  'cursor_test_save_memory_key',
  'Updated version'
)
ON CONFLICT (user_id, tenant_id, category, key)
DO UPDATE SET content = EXCLUDED.content, updated_at = now()
RETURNING key, content;

SELECT count(*) AS row_count
FROM public.ai_memory
WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
  AND category = 'instructions'
  AND key = 'cursor_test_save_memory_key';

-- 4) Different tenant, same key — must succeed (no collision)
INSERT INTO public.ai_memory (tenant_id, user_id, category, key, content)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  NULL,
  'instructions',
  'cursor_test_save_memory_key',
  'Other tenant copy'
)
ON CONFLICT (user_id, tenant_id, category, key) DO NOTHING;

-- Cleanup test rows (optional)
-- DELETE FROM public.ai_memory WHERE key = 'cursor_test_save_memory_key';
