-- Add shared_from_state_id column to allow shadow records pointing to a primary bot
ALTER TABLE public.telegram_bot_state
ADD COLUMN IF NOT EXISTS shared_from_state_id uuid REFERENCES public.telegram_bot_state(id) ON DELETE CASCADE;

-- Drop existing unique constraint on tenant_id if exists (allows shared shadow records)
DO $$
DECLARE
  constraint_name_var text;
BEGIN
  SELECT conname INTO constraint_name_var
  FROM pg_constraint
  WHERE conrelid = 'public.telegram_bot_state'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%tenant_id%'
    AND pg_get_constraintdef(oid) NOT LIKE '%shared_from_state_id%';
  
  IF constraint_name_var IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.telegram_bot_state DROP CONSTRAINT %I', constraint_name_var);
  END IF;
END $$;

-- Create partial unique index: only one primary (non-shared) record per tenant
CREATE UNIQUE INDEX IF NOT EXISTS telegram_bot_state_tenant_primary_unique
ON public.telegram_bot_state (tenant_id)
WHERE shared_from_state_id IS NULL;

-- Create unique index for shared records (one shadow per source per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS telegram_bot_state_tenant_shared_unique
ON public.telegram_bot_state (tenant_id, shared_from_state_id)
WHERE shared_from_state_id IS NOT NULL;

-- Add index for lookups by shared_from_state_id
CREATE INDEX IF NOT EXISTS idx_telegram_bot_state_shared_from
ON public.telegram_bot_state (shared_from_state_id)
WHERE shared_from_state_id IS NOT NULL;

-- RLS: allow source tenant owner to create shadow records in tenants they belong to
DROP POLICY IF EXISTS "Users can create shared telegram bot state" ON public.telegram_bot_state;
CREATE POLICY "Users can create shared telegram bot state"
ON public.telegram_bot_state
FOR INSERT
TO authenticated
WITH CHECK (
  shared_from_state_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.telegram_bot_state src
    WHERE src.id = shared_from_state_id
      AND src.tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
      )
  )
  AND tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

-- RLS: allow deleting shared records if user belongs to either source or target tenant
DROP POLICY IF EXISTS "Users can delete shared telegram bot state" ON public.telegram_bot_state;
CREATE POLICY "Users can delete shared telegram bot state"
ON public.telegram_bot_state
FOR DELETE
TO authenticated
USING (
  shared_from_state_id IS NOT NULL
  AND (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.telegram_bot_state src
      WHERE src.id = shared_from_state_id
        AND src.tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    )
  )
);