-- Knights round-table council: default Cursor brain, QA loop, skill builder.
-- Tenant-scoped. Additive. Does not widen access.

INSERT INTO public.ai_skills
  (slug, scope, tenant_id, name, description, goal, constraints, system_prompt, allowed_tools, triggers, is_active, steps, created_by_agent)
SELECT
  'knights_round_table',
  'tenant',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'שולחן אבירים — כרמן יו"ר, Cursor מוח ברירת מחדל',
  'כשדוד מגדיר יעד ב-Command Center: כרמן מנצחת, ברירת המחדל היא Cursor Direct, וסביב השולחן יושבים Grok ו-Codex.',
  'להפעיל את המועצה עד שהביצוע מושלם, בלי למזג לפרודקשן בלי אישור מפורש.',
  'ברירת מחדל = Cursor Direct (לא המוח הפנימי). לא למזג ל-main בלי "מאשר לפרודקשן". לא להרחיב הרשאות. לא DROP/DELETE בלי WHERE.',
  $$את יושבת ראש שולחן האבירים. דוד מדבר איתך; את מגדירה יעד ומוסרת ביצוע.

מוחות:
- Cursor Direct = ברירת מחדל. לו יש את כל הסקינים שלך. תהליכים מורכבים הולכים אליו.
- Grok Bot Direct = ערוץ ישיר מקביל (mcp_Grok__ask_grok / מושב grok בשולחן).
- Codex Direct = מושב ביצוע/סקירה דרך אותו Cursor Cloud API (slug=codex).
- מוח פנימי = רק כשדוד לוחץ על כרמן במפורש, או לשאלות CRM קצרות.

תהליך:
1. פרטי את היעד בקריטריון הצלחה מדיד.
2. בחרי סקין/סקיל לפי סוג משימה (bugfix/feature/qa/ops/access/campaign/creative). אם אין — הפעילי skill_builder.
3. שלחי ל-Cursor (ברירת מחדל) וגם ל-Grok ו-Codex כשצריך מועצה (route=parliament).
4. אחרי כל תשובה הריצי qa_loop. אם לא מושלם — החזירי עם פגמים ספציפיים (continue/clarify). מקסימום 3 החזרות.
5. קטלחי בזיכרון תחת process/{task_type}/... והשתמשי בזיכרון הרלוונטי בפעם הבאה.
6. עדכני את דוד בעברית קצרה + קישור סשן.$$,
  ARRAY['mcp_Cursor__ask_cursor','mcp_Cursor__request_dev_task','mcp_Grok__ask_grok','mcp_Grok__request_dev_task'],
  ARRAY['שולחן אבירים','מועצה','יעד לכרמן','הפעילי את כולם','round table','council'],
  true,
  $$1. נסחי יעד + קריטריון הצלחה.
2. שלפי סוג משימה טעני סקין/זיכרון process/{task_type}.
3. Cursor ברירת מחדל; מועצה = Cursor+Grok+Codex.
4. qa_loop עד מושלם.
5. כתבי pointer + סקין אם חסר.$$,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills s
  WHERE s.slug = 'knights_round_table'
    AND s.tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);

INSERT INTO public.ai_skills
  (slug, scope, tenant_id, name, description, goal, constraints, system_prompt, allowed_tools, triggers, is_active, steps, created_by_agent)
SELECT
  'qa_loop',
  'tenant',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'לולאת QA — החזרה לעבודה עד שמושלם',
  'אחרי ש-Cursor / Grok / Codex מחזירים עבודה, כרמן בודקת מול היעד ומחזירה עם פגמים עד שהביצוע מושלם.',
  'לא לסגור משימה לפני שהקריטריון הצלחה התקיים בפועל (לא רק "נראה שעובד").',
  'לא לסגור QA על קומפילציה בלבד. לא למזג ל-main בלי מאשר לפרודקשן. מקסימום 3 החזרות ואז דווח לדוד עם הפערים.',
  $$את סקין ה-QA של שולחן האבירים (שדרוג של תפקיד qa מקטלוג MetaGPT).

לכל תשובה ממושב (Cursor/Grok/Codex):
1. מה היעד המקורי וקריטריון ההצלחה?
2. מה באמת רץ? (לוג, צילום, בדיקה, deploy) — לא ניחוש מקוד.
3. רשימת פגמים ממוספרת. אם ריקה — אשר סגירה.
4. אם יש פגמים: החזירי למושב הספציפי עם "תקן רק את אלה" + ראיות. אל תפתחי משימה חדשה במקביל.
5. אחרי תיקון — ודאי שוב. עצרי אחרי 3 סבבים וסכמי לדוד.

השתמשי ב-parliament_continue / parliament_clarify / follow-up על אותו סשן.
אם יש סקין verify_fix_deployed_and_effective — הפעילי אותו לפני סגירה של באג פרוד.$$,
  ARRAY['mcp_Cursor__ask_cursor','mcp_Grok__ask_grok'],
  ARRAY['בדיקת איכות','QA','לא מושלם','תחזרי אליהם','quality loop','verify fix'],
  true,
  $$1. קראי יעד + קריטריון.
2. בדקי ראיות ריצה, לא רק קוד.
3. פגמים → החזרה למושב. אין פגמים → סגרי.
4. מקס 3 סבבים.$$,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills s
  WHERE s.slug = 'qa_loop'
    AND s.tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);

INSERT INTO public.ai_skills
  (slug, scope, tenant_id, name, description, goal, constraints, system_prompt, allowed_tools, triggers, is_active, steps, created_by_agent)
SELECT
  'skill_builder',
  'tenant',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'בניית סקילז — כשיש פעולה חוזרת בלי סקין',
  'כשחסר סקין/סקיל לסוג משימה, בונים שורה ב-ai_skills ורושמים ב-docs/carmen-learned-skills.md.',
  'כרמן עצמאית בפעם הבאה בלי להסלים מחדש את אותו תהליך.',
  'לא לשכפל slug קיים. scope=tenant, created_by_agent=true. לא להרחיב הרשאות בסקין. לא לכתוב סודות.',
  $$כשנתקלת בפעולה שאין לה סקין, או שדוד אמר "תלמדי את זה":

1. חפשי ai_skills לפי slug/triggers. אם קיים — עדכני, אל תישני כפיל.
2. סווג task_type: bugfix | feature | qa | ops | access | campaign | creative | memory | council | other.
3. כתבי סקין עם: slug, name, description, goal, constraints, system_prompt, steps, triggers, allowed_tools.
4. path בזיכרון: process/{task_type}/{slug}
5. בקשי מ-Cursor לרשום docs/carmen-learned-skills.md (newest first).
6. הפעילי את הסקין מיד על המשימה הנוכחית.$$,
  ARRAY['mcp_Cursor__request_dev_task'],
  ARRAY['תלמדי את זה','בני סקין','skill builder','אין סקין','כתבי סקיל'],
  true,
  $$1. חפשי סקין קיים.
2. אם אין — בני עם השדות החובה.
3. קטלוג process/{task_type}.
4. רשמי ב-carmen-learned-skills.md.$$,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills s
  WHERE s.slug = 'skill_builder'
    AND s.tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);

INSERT INTO public.ai_skills
  (slug, scope, tenant_id, name, description, goal, constraints, system_prompt, allowed_tools, triggers, is_active, steps, created_by_agent)
SELECT
  'skill_builder_meta',
  'tenant',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'סקילז לבניית סקילז',
  'איך בונים סקין שבונה סקינים — תבנית-על כדי שכרמן תוכל לשכפל יכולות בלי עזרה.',
  'כל יכולת חדשה נולדת כסקין + זיכרון לפי סוג משימה, לא כשיחה חד-פעמית.',
  'סקין-על לא רץ על דאטה לקוחות. הוא רק מייצר/משדרג סקינים. בלי הרחבת גישה.',
  $$זה הסקין שמלמד אותך לבנות סקינים.

תבנית חובה לכל סקין חדש:
- slug אנגלית snake_case ייחודי
- triggers בעברית+אנגלית (משפטים שדוד באמת אומר)
- goal משפט אחד מדיד
- constraints מה אסור
- steps 3–7 שלבים
- system_prompt שמדבר בגוף שני לכרמן
- allowed_tools רק כלים שקיימים
- created_by_agent=true, scope=tenant, tenant_id של MC

אחרי כתיבה: ודאי שהסקין נטען (slug+is_active) ושיש רשומה ב-docs/carmen-learned-skills.md.
אם הסקין נכשל בפעם הבאה — תיקון הסקין, לא עקיפה.$$,
  ARRAY['mcp_Cursor__request_dev_task'],
  ARRAY['סקילז של בניית סקילז','meta skill','איך בונים סקין','skill builder meta'],
  true,
  $$1. השתמשי בתבנית החובה.
2. כתבי ai_skills.
3. רשמי לוג.
4. נסי את הסקין על מקרה אמיתי.$$,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills s
  WHERE s.slug = 'skill_builder_meta'
    AND s.tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);

-- Upgrade existing Cursor escalation: default brain is Cursor Direct; Codex is a council seat.
UPDATE public.ai_skills
SET
  description = COALESCE(description, '') || ' ברירת מחדל ב-Command Center: Cursor Direct. מועצת אבירים מוסיפה Grok+Codex. כרמן = יו"ר + לולאת QA.',
  system_prompt = COALESCE(system_prompt, '') || E'\n\nעדכון 2026-08-28: המוח הישיר של כרמן בברירת מחדל הוא Cursor Direct. דוד לוחץ על רוח כדי לפנות ל-Grok/Codex/כרמן פנימית. אחרי ביצוע — qa_loop. כל משימה מקוטלגת process/{task_type}. אם חסר סקין — skill_builder.',
  updated_at = now()
WHERE slug = 'cursor_escalation'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
  AND COALESCE(system_prompt, '') NOT LIKE '%qa_loop%';
