-- Access control for Carmen (and any agent): denylists on ai_agents.
-- Default behavior is UNCHANGED — Carmen has access to everything. These are
-- subtractive: an empty array (the default) means "all enabled". The settings UI
-- writes slugs/names here to turn a specific tool / skin / integration OFF.
--
-- Why a denylist (not the existing allowed_tools allowlist): allowed_tools is an
-- allowlist where non-empty means "ONLY these", which makes "all except X"
-- awkward. A denylist lets the default stay "all on" and subtract specific items,
-- matching the requested UX ("access to everything, toggle individual ones off").

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS disabled_tools text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS disabled_skins text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS disabled_integrations text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.ai_agents.disabled_tools IS 'Tool names turned OFF for this agent. Empty = all tools enabled.';
COMMENT ON COLUMN public.ai_agents.disabled_skins IS 'Skin slugs turned OFF for this agent. Empty = all skins enabled.';
COMMENT ON COLUMN public.ai_agents.disabled_integrations IS 'Integration/MCP connection names turned OFF for this agent. Empty = all enabled.';
