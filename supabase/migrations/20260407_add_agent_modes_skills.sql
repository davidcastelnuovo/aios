-- Add active_modes and active_skills to ai_agents
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS active_modes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS active_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS writing_style TEXT DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS response_length TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'he';

COMMENT ON COLUMN public.ai_agents.active_modes IS 'מצבי פעולה פעילים של הסוכן (sales, support, copywriting, analyst, scheduler, onboarding)';
COMMENT ON COLUMN public.ai_agents.active_skills IS 'סקילז פעילים של הסוכן לפי ID';
COMMENT ON COLUMN public.ai_agents.writing_style IS 'סגנון כתיבה: professional, friendly, formal, casual, empathetic';
COMMENT ON COLUMN public.ai_agents.response_length IS 'אורך תשובות: short, medium, detailed';
COMMENT ON COLUMN public.ai_agents.language IS 'שפה מועדפת: he, en, ar, auto';
