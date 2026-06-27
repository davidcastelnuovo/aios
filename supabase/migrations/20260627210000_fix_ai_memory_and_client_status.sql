-- ============================================================
-- Fix 1: ai_memory.user_id — allow NULL for system/agent writes
-- ============================================================
-- The FK constraint ai_memory_user_id_fkey references auth.users(id).
-- When the agent runs as 'system' (no real user), the code falls back to
-- SYSTEM_USER_UUID = '00000000-0000-0000-0000-000000000000' which doesn't
-- exist in auth.users, causing the FK violation.
-- Fix: make user_id nullable (NULL = system/agent write).

-- Step 0: Nullify any orphaned user_ids (rows whose user_id no longer exists in auth.users)
-- This cleans up stale data before we re-add the FK constraint.
UPDATE public.ai_memory
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND user_id NOT IN (SELECT id FROM auth.users);

-- Step 1: Drop the old unique constraint and FK
ALTER TABLE public.ai_memory
  DROP CONSTRAINT IF EXISTS ai_memory_user_id_tenant_id_category_key_key;

ALTER TABLE public.ai_memory
  DROP CONSTRAINT IF EXISTS ai_memory_user_id_fkey;

-- Step 2: Make user_id nullable
ALTER TABLE public.ai_memory
  ALTER COLUMN user_id DROP NOT NULL;

-- Step 3: Re-add FK (nullable FK is fine — NULL means system/agent write)
ALTER TABLE public.ai_memory
  ADD CONSTRAINT ai_memory_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 4: Re-add unique constraint using COALESCE so that NULL user_id
-- (system writes) still enforces uniqueness per (tenant, category, key).
DROP INDEX IF EXISTS public.ai_memory_user_id_tenant_id_category_key_key;
CREATE UNIQUE INDEX ai_memory_user_id_tenant_id_category_key_key
  ON public.ai_memory (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), tenant_id, category, key);

-- ============================================================
-- Fix 2: client_status enum — add 'inactive' value
-- ============================================================
-- The tool definition and agent prompts use 'inactive' as a valid status,
-- but the enum only has: active, paused, ended, onboarding.
-- Fix: add 'inactive' to the enum so update_client_status works correctly.

ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'inactive';

