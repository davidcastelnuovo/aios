-- Staging: ensure existing 20:30 Binat shutdown agent_tasks use deterministic broad scope + David notify.
-- Safe to re-run (updates only rows that match the evening Binat shutdown pattern).

UPDATE public.agent_tasks t
SET result = COALESCE(t.result, '{}'::jsonb) || jsonb_build_object(
  'campaign_shutdown_job', jsonb_build_object(
    'client_name_search', 'Binat',
    'scope', jsonb_build_object('mode', 'all_client_campaigns'),
    'auto_pause', true,
    'notify_david', true
  )
)
WHERE t.tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
  AND t.enabled = true
  AND (
    t.title ILIKE '%20:30%'
    OR t.title ILIKE '%20.30%'
    OR COALESCE(t.description, '') ILIKE '%20:30%'
  )
  AND (
    t.title ILIKE '%binat%'
    OR t.title ILIKE '%בינת%'
    OR COALESCE(t.description, '') ILIKE '%binat%'
    OR COALESCE(t.description, '') ILIKE '%בינת%'
  );
