-- Add allowed_tools and system_prompt to ai_agents
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS allowed_tools TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS system_prompt TEXT,
  ADD COLUMN IF NOT EXISTS max_tool_rounds INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.ai_agents.allowed_tools IS 'רשימת שמות הtools שהסוכן מורשה להפעיל. ריק = גישה לכל הtools.';
COMMENT ON COLUMN public.ai_agents.system_prompt IS 'פרומפט מערכת מותאם אישית לסוכן (מחליף את הבנייה האוטומטית מ-personality/soul/talent)';
COMMENT ON COLUMN public.ai_agents.max_tool_rounds IS 'מספר מקסימלי של סיבובי tool calling (ברירת מחדל: 3)';
