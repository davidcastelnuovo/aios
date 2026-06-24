-- Add a swappable "mood" to AI agents (primarily Carmen).
-- Values: 'fun' | 'focused' | 'tired' | 'angry' | 'random' | NULL.
-- NULL = no mood modulation (base persona). 'random' rotates deterministically
-- every 3 days in the run-ai-agent edge function. Tone-only: it never overrides
-- the agent's hard rules or its duty to complete the task.
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS mood text;

COMMENT ON COLUMN public.ai_agents.mood IS
  'Swappable persona mood: fun|focused|tired|angry|random|NULL. Read by run-ai-agent to modulate tone only.';
