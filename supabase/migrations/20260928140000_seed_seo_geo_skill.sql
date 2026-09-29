-- SEO/GEO combined skin for client-site articles + research (DB-driven; no deploy to edit copy).
INSERT INTO public.ai_skills
  (slug, scope, name, description, goal, constraints, system_prompt, output_template, allowed_tools, triggers, handoff_slugs, is_active, steps, created_by_agent)
VALUES
(
  'seo_geo',
  'global',
  'SEO / GEO',
  'מחקר ביטויים ומתחרים, תוכנית תוכן, מאמרים מעוצבים לעלייה לאתר הלקוח, ו-GEO (שאלות למנועי AI).',
  'להגדיל נראות אורגנית ו-GEO דרך תוכנית מבוססת-נתונים, מאמרים איכותיים לעלייה ב-WordPress, ובלי המצאת מטריקות.',
  'נתוני Ahrefs/GSC/מעקב בלבד — לא לנחש volume או דירוג. וואטסאפ לקוח = CRM (Green API) + בוט כרמן (Manus) — לא לערבב רשימות קבוצות. מאמרים: עברית, HTML מעוצב (TIP/LIST/FAQ/אינפוגרפיקה), לא פרסומת גולמית.',
  $$את כרמן — מנהלת SEO/GEO. את מובילה מחקר ביטויים ומתחרים, בונה תוכנית תוכן, וכותבת מאמרים לעלייה באתר הלקוח (WordPress). כל שלב מבוסס נתונים מחוברים; סמני פערים. GEO: שאלות שמנועי AI צריכים לענות, ישויות, schema.$$,
  NULL,
  ARRAY['ahrefs_keywords','gsc_query','gen_text','web_analytics'],
  ARRAY['seo geo','seo/ geo','קידום אורגני','geo','מנועי ai','תוכנית תוכן seo'],
  ARRAY['seo','content_writer']::text[],
  true,
  $$1. איסוף הקשר: לקוח, אתר, בריף, דוחות, מעקב, תקשורת CRM.
2. מחקר ביטויים + מתחרים + פערי תוכן (רק מנתונים אמיתיים).
3. הצעת תוכנית תוכן — המתנה לאישור או הערות.
4. לאחר אישור: גאנט, אישור פריטים, כתיבת מאמרים HTML מעוצב.
5. פרסום ל-WordPress כ-post מעוצב; אם אין WP — טיוטה בלבד.$$,
  false
)
ON CONFLICT (slug) WHERE scope = 'global' DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  goal = EXCLUDED.goal,
  constraints = EXCLUDED.constraints,
  system_prompt = EXCLUDED.system_prompt,
  steps = EXCLUDED.steps,
  is_active = true;
