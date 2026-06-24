-- Skin schema upgrade for ai_skills
-- Grounds the "skin" (role-persona) model on the canonical OSS pattern shared by
-- MetaGPT (profile/goal/constraints), CrewAI (role/goal/backstory) and AutoGen
-- (system_message + description + handoffs). Our ai_skills table already covers
-- ~90% of that schema; this adds the 3 missing first-class fields:
--   goal           — the skin's objective, kept separate from persona prose so a
--                    router can score/select skins (MetaGPT `goal`, CrewAI `goal`).
--   constraints    — hard guardrails that tone/mood may never override
--                    (MetaGPT `constraints`; mirrors CLAUDE.md "mood is tone-only").
--   handoff_slugs  — which other skins this skin may hand off to / chain into
--                    (MetaGPT `watch`, AutoGen `handoffs`).
-- All nullable / defaulted — non-breaking for existing rows and the registry loader.

ALTER TABLE public.ai_skills
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS constraints text,
  ADD COLUMN IF NOT EXISTS handoff_slugs text[] DEFAULT '{}'::text[];

-- Bump version when the new persona-defining fields change, same as the existing
-- content fields, so the registry cache (30s TTL) picks up edits without a deploy.
CREATE OR REPLACE FUNCTION public.bump_ai_skill_version()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW.system_prompt   IS DISTINCT FROM OLD.system_prompt
    OR NEW.output_template IS DISTINCT FROM OLD.output_template
    OR NEW.allowed_tools   IS DISTINCT FROM OLD.allowed_tools
    OR NEW.triggers        IS DISTINCT FROM OLD.triggers
    OR NEW.steps           IS DISTINCT FROM OLD.steps
    OR NEW.goal            IS DISTINCT FROM OLD.goal
    OR NEW.constraints     IS DISTINCT FROM OLD.constraints
    OR NEW.handoff_slugs   IS DISTINCT FROM OLD.handoff_slugs
  ) THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger definition unchanged; recreated defensively so a fresh DB is consistent.
DROP TRIGGER IF EXISTS bump_ai_skill_version_trg ON public.ai_skills;
CREATE TRIGGER bump_ai_skill_version_trg
BEFORE UPDATE ON public.ai_skills
FOR EACH ROW EXECUTE FUNCTION public.bump_ai_skill_version();
