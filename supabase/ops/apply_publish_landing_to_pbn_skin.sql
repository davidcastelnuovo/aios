-- Carmen skin: publish a Hebrew RTL landing/article to an existing magazine PBN site.
-- Lookup publishing_sites by site_key. Never invent domains. Confirm GET 200 before returning URL.

INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  goal, constraints, trigger_phrases, triggers, steps, system_prompt, allowed_tools
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'publish_landing_to_pbn',
  'פרסום דף נחיתה לאתר PBN קיים',
  'כשדוד מבקש לפרסם דף נחיתה/מאמר לאתר PBN (site-01..site-10) — מחפשים את האתר ב-publishing_sites, כותבים שורת publishing_articles בסטטוס published, ומחזירים את ה-HTTPS החי רק אחרי GET 200.',
  'לפרסם לעמוד חי על האתר הקיים דרך פיד המגזין, בלי להמציא דומיין ובלי דיפלוי סטטי נפרד.',
  'לא להמציא URL. לא לפרסם בלי target_url אמיתי. לא לערבב קופי מאירועים שונים. לא DROP/DELETE בלי WHERE. לא להרחיב הרשאות.',
  ARRAY[
    'פרסמי לדף נחיתה ב-PBN',
    'תעלי לאתר PBN',
    'publish landing to PBN',
    'publish to site-03',
    'מרחב עסקי דף נחיתה',
    'LEVEL Up MASTERCLASS PBN',
    'תשתמש באחד מאתרי ה pbn'
  ],
  ARRAY[
    'פרסום לאתר PBN',
    'publish landing page to PBN site'
  ],
  $$1. SELECT מ-publishing_sites לפי site_key (למשל site-03) ו-tenant_id. status=active. ה-URL הקנוני הוא base_url — לעולם לא ממציאים דומיין.
2. *.vercel.app של אותו פרויקט (aios-magazine-site-NN) הוא אותו דיפלוי, לא אתר אחר. מחזירים base_url.
3. חובה target_url אמיתי (וואטסאפ/הרשמה מהלקוח). בלי זה לא מפרסמים.
4. INSERT/UPSERT publishing_articles: status=published, slug, live_url={base_url}/articles/{slug}, content=jsonb מערך מחרוזות (## כותרות, LIST:, TIP:), anchor_text, category מקטגוריות האתר, client_id אם ידוע. ייחודי: (tenant_id, target_url, primary_keyword, proposed_topic).
5. GET ל-live_url חייב 200 וגם href של target_url ב-HTML. פיד publishing-feed עם cache ~60 שנ'. אל תחזירי URL לפני 200.
6. domain-connections / redeploy Vercel רק אם הפיד לא קולט. לא צריך דיפלוי HTML סטטי נפרד.$$,
  $$כשדוד או כרמן מבקשים לפרסם דף נחיתה לאתר PBN קיים (למשל מרחב עסקי / site-03):

HARD RULES
- דומיין רק מ-publishing_sites.base_url. אסור להמציא.
- URL חי מדווח רק אחרי GET 200.
- CTA = target_url אמיתי מהלקוח/וואטסאפ. הרנדר מקשר את anchor_text או מוסיף <a>.
- אתרי המגזין site-01..site-10 הם פיד: insert published → publishing-feed?site_id= → api/article.js ב-Vercel. לא FTP/S3.
- אתרים external-* / wordpress הם נתיב אחר — לא פיד המגזין.

שלבים
1. מצאי את השורה: site_key + tenant_id, status=active, connection_id = פרויקט Vercel aios-magazine-{site_key}.
2. live_url = rtrim(base_url,'/') || '/articles/' || slug.
3. כתבי publishing_articles published עם תוכן עברית RTL. פורמט תוכן: מערך מחרוזות; "## "→h2, "LIST: a|b"→ul, "TIP:"→aside.
4. אמתי GET 200 + href של target_url. אם cache ישן — חכי עד ~60 שנ' או cache: no-store.
5. החזירי לדוד רק את ה-HTTPS הקנוני (base_url), לא את vercel.app.

דוגמה חיה (2026-08-28): site-03 מרחב עסקי base_url=https://ai-online.online
מאמר LEVEL Up MASTERCLASS → https://ai-online.online/articles/level-up-masterclass
לקוח איימי בכור, CTA https://wa.me/972523646766, slug level-up-masterclass.
קופי אוקטובר 2026 (15.10.2026, אשטרום פורט מגדלי LYFE) — לא לערבב עם סדנת Lovable מדצמבר 2025.$$,
  ARRAY['execute_sql']
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'publish_landing_to_pbn'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);

UPDATE public.ai_skills SET
  description = 'כשדוד מבקש לפרסם דף נחיתה/מאמר לאתר PBN (site-01..site-10) — מחפשים את האתר ב-publishing_sites, כותבים שורת publishing_articles בסטטוס published, ומחזירים את ה-HTTPS החי רק אחרי GET 200.',
  goal = 'לפרסם לעמוד חי על האתר הקיים דרך פיד המגזין, בלי להמציא דומיין ובלי דיפלוי סטטי נפרד.',
  constraints = 'לא להמציא URL. לא לפרסם בלי target_url אמיתי. לא לערבב קופי מאירועים שונים. לא DROP/DELETE בלי WHERE. לא להרחיב הרשאות.',
  trigger_phrases = ARRAY[
    'פרסמי לדף נחיתה ב-PBN',
    'תעלי לאתר PBN',
    'publish landing to PBN',
    'publish to site-03',
    'מרחב עסקי דף נחיתה',
    'LEVEL Up MASTERCLASS PBN',
    'תשתמש באחד מאתרי ה pbn'
  ],
  triggers = ARRAY[
    'פרסום לאתר PBN',
    'publish landing page to PBN site'
  ],
  steps = $$1. SELECT מ-publishing_sites לפי site_key (למשל site-03) ו-tenant_id. status=active. ה-URL הקנוני הוא base_url — לעולם לא ממציאים דומיין.
2. *.vercel.app של אותו פרויקט (aios-magazine-site-NN) הוא אותו דיפלוי, לא אתר אחר. מחזירים base_url.
3. חובה target_url אמיתי (וואטסאפ/הרשמה מהלקוח). בלי זה לא מפרסמים.
4. INSERT/UPSERT publishing_articles: status=published, slug, live_url={base_url}/articles/{slug}, content=jsonb מערך מחרוזות (## כותרות, LIST:, TIP:), anchor_text, category מקטגוריות האתר, client_id אם ידוע. ייחודי: (tenant_id, target_url, primary_keyword, proposed_topic).
5. GET ל-live_url חייב 200 וגם href של target_url ב-HTML. פיד publishing-feed עם cache ~60 שנ'. אל תחזירי URL לפני 200.
6. domain-connections / redeploy Vercel רק אם הפיד לא קולט. לא צריך דיפלוי HTML סטטי נפרד.$$,
  system_prompt = $$כשדוד או כרמן מבקשים לפרסם דף נחיתה לאתר PBN קיים (למשל מרחב עסקי / site-03):

HARD RULES
- דומיין רק מ-publishing_sites.base_url. אסור להמציא.
- URL חי מדווח רק אחרי GET 200.
- CTA = target_url אמיתי מהלקוח/וואטסאפ. הרנדר מקשר את anchor_text או מוסיף <a>.
- אתרי המגזין site-01..site-10 הם פיד: insert published → publishing-feed?site_id= → api/article.js ב-Vercel. לא FTP/S3.
- אתרים external-* / wordpress הם נתיב אחר — לא פיד המגזין.

שלבים
1. מצאי את השורה: site_key + tenant_id, status=active, connection_id = פרויקט Vercel aios-magazine-{site_key}.
2. live_url = rtrim(base_url,'/') || '/articles/' || slug.
3. כתבי publishing_articles published עם תוכן עברית RTL. פורמט תוכן: מערך מחרוזות; "## "→h2, "LIST: a|b"→ul, "TIP:"→aside.
4. אמתי GET 200 + href של target_url. אם cache ישן — חכי עד ~60 שנ' או cache: no-store.
5. החזירי לדוד רק את ה-HTTPS הקנוני (base_url), לא את vercel.app.

דוגמה חיה (2026-08-28): site-03 מרחב עסקי base_url=https://ai-online.online
מאמר LEVEL Up MASTERCLASS → https://ai-online.online/articles/level-up-masterclass
לקוח איימי בכור, CTA https://wa.me/972523646766, slug level-up-masterclass.
קופי אוקטובר 2026 (15.10.2026, אשטרום פורט מגדלי LYFE) — לא לערבב עם סדנת Lovable מדצמבר 2025.$$,
  allowed_tools = ARRAY['execute_sql'],
  is_active = true,
  updated_at = now()
WHERE slug = 'publish_landing_to_pbn'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid;

UPDATE public.cursor_dispatches
SET status = 'completed'
WHERE id IN (
  '14bb71a5-4955-44dd-94f7-f33e1dd2b358',
  '1d3a46eb-8f41-4b4c-bfde-48e90ad77f74',
  'b0171254-bbec-485a-8f06-771c3f931ad5'
)
AND status = 'dispatched';

INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'claude',
  'publish_pbn_landing',
  'publishing_articles:c108ee9a-1dc9-4803-a767-df2dd6c40946',
  jsonb_build_object(
    'agent', 'cursor',
    'site_key', 'site-03',
    'site_name', 'מרחב עסקי',
    'live_url', 'https://ai-online.online/articles/level-up-masterclass',
    'http_status', 200,
    'slug', 'level-up-masterclass',
    'client', 'איימי בכור',
    'skin', 'publish_landing_to_pbn'
  )
);

SELECT public.claude_notify_david(
  $m$דוד, דף LEVEL Up MASTERCLASS עלה למרחב עסקי:
https://ai-online.online/articles/level-up-masterclass
HTTP 200, עברית RTL. הרשמה: https://wa.me/972523646766$m$,
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  '972507677613@c.us'
);
