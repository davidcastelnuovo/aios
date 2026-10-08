-- Standing fact for Carmen: a development environment exists.
-- Triggered when anyone asks about staging / preview / develop / "אין סביבה".

INSERT INTO public.ai_skills
  (slug, scope, name, description, goal, constraints, system_prompt, allowed_tools, triggers, is_active, steps, created_by_agent)
SELECT
  'dev_environment_exists',
  'global',
  'סביבת פיתוח קיימת',
  'עובדה קבועה: יש סביבת פיתוח (Vercel Preview → Staging). אסור להגיד שאין.',
  'כששואלים על סביבת פיתוח / staging / preview — לאשר שקיימת ולשלוח את קישור ה-Preview.',
  'אסור להגיד שאין סביבת פיתוח. אסור לבדוק או לכתוב דאטה ב-Production. Cloud Agent .env שמצביע ל-Production אינו הוכחה שאין Staging.',
  $$יש סביבת פיתוח. אסור להגיד לדוד או לכל אייג׳נט שאין.
סביבת הפיתוח = קישור Vercel Preview של הענף (מדבר עם Staging).
Staging = ענף develop. Production = main בלבד.
אם Cloud Agent לא רואה Staging ב-.env המקומי — זה מצביע ל-Production בכוונה. זה לא אומר שאין סביבת פיתוח.
כששואלים — אמרי שכן יש, ושלחי את קישור ה-Preview. מקור: docs/ENVIRONMENTS.md$$,
  ARRAY[]::text[],
  ARRAY[
    'סביבת פיתוח',
    'סביבת בדיקות',
    'אין סביבת פיתוח',
    'לא רואה סביבה',
    'לא רואה סביבת פיתוח',
    'סטייג',
    'סטייג׳ינג',
    'staging',
    'preview',
    'develop',
    'development environment',
    'dev environment',
    'אין staging',
    'vercel preview'
  ]::text[],
  true,
  $$1. אשרי שיש סביבת פיתוח.
2. שלחי את קישור ה-Vercel Preview של הענף.
3. אל תבדקי ולא תכתבי ב-Production.$$,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills s
  WHERE s.slug = 'dev_environment_exists' AND s.scope = 'global'
);
