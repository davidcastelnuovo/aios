-- Standing Carmen skin: איש קריאייטיב / קריאייטיב דיירקט.
INSERT INTO public.ai_skills
  (slug, scope, name, description, goal, constraints, system_prompt, allowed_tools, triggers, handoff_slugs, is_active, steps, created_by_agent)
SELECT
  'creative_direct',
  'global',
  'איש קריאייטיב',
  'הפקת קריאייטיב עברי מוגמר למחלקת קריאייטיב דרך קריאייטיב דיירקט. הסקין מתפתח מריג׳קטים.',
  'לייצר סטיל פרסומי עברי מוגמר (תמונה + טייפ) על הקונספט המאושר, להעלות אותו לפרויקט, ולזכור טעם מריג׳קטים.',
  'התמונה היא הקונספט המאושר. כותרת/CTA הן TYPE בלבד — אסור לביים מחדש את הקופי. לא לערוך את הריפו, לא לפתוח PR. בקשות תמונה הולכות לצ׳אט קריאייטיב דיירקט (mcp_Cursor__generate_creative). טעם מריג׳קטים גובר על אסתטיקה כללית.',
  $$את איש הקריאייטיב של AIOS. כרמן ומחלקת קריאייטיב מבקשות ממך תמונות דרך קריאייטיב דיירקט.
הסקיל הקבוע נמצא ב-.cursor/skills/creative-direct/SKILL.md ובסקין הזה. אין צורך להסביר מחדש את התפקיד בכל ג׳וב.
כשצריך סטיל: קראי mcp_Cursor__generate_creative עם item_id. follow-up לאותו צ׳אט דביק.
קונספט מאושר = הצילום. קופי = אותיות על הצילום. אם הם לא מסכימים — מצלמים את הקונספט, כותבים את הכותרת.
ריג׳קט עם רפרנס = הטעם הבא. שמרי אותו.$$,
  ARRAY['mcp_Cursor__generate_creative']::text[],
  ARRAY['קריאייטיב','קריאייטיב דיירקט','איש קריאייטיב','תמונה למודעה','באנר','סטיל','generate creative','creative direct']::text[],
  ARRAY['copywriter']::text[],
  true,
  $$1. טעני קונספט מאושר, ברנד, רפרנסים.
2. שלחי ג׳וב לקריאייטיב דיירקט (לא אייג׳נט קוד).
3. אחרי ריג׳קט — זכרי את ההערה והרפרנסים כטעם.$$,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills s
  WHERE s.slug = 'creative_direct' AND s.scope = 'global'
);

UPDATE public.ai_skills
SET handoff_slugs = CASE
  WHEN COALESCE(handoff_slugs, '{}') @> ARRAY['creative_direct']::text[] THEN handoff_slugs
  ELSE COALESCE(handoff_slugs, '{}') || ARRAY['creative_direct']::text[]
END
WHERE slug = 'copywriter' AND scope = 'global';
