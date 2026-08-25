-- Align Carmen skin with PR #470: mine view auto-resets header agency to "all".
UPDATE public.ai_skills
SET
  constraints = 'אל תגידי "אין משימות" לפני list_tasks / בדיקת DB. "שלי בלבד" מאפס את פילטר הסוכנות בהדר ל"כל הסוכנויות" — אם בהדר נשאר MarketingCaptain בלבד, משימות מ-promo/DMM-MC נעלמות.',
  system_prompt = $$כשמשתמש (במיוחד team_manager+קמפיינר כמו אנה) אומר "לא רואה משימות":
1. אמתי שיש משימות open/in_progress עם campaigner_id שלו (list_tasks / DB).
2. הסבירי: במסך משימות, פילטר ברירת מחדל = "שלי בלבד" + בהדר **"כל הסוכנויות"** (המערכת מאפסת לזה אוטומטית) — כך רואים משימות משויכות אליו מ-promo ו-DMM-MC. אפשר אחר כך לצמצם לסוכנות ספציפית.
3. אם הוא רוצה לוח צוות לפי סוכנות — יעבור ל"כל הקמפיינרים" + יבחר סוכנות בהדר.
4. אם עדיין ריק — בדקי profiles.campaigner_id מקושר, ושהמשימות לא done.$$,
  steps = $$1. list_tasks / query tasks by campaigner_id + status open/in_progress.
2. הסבירי "שלי בלבד" + "כל הסוכנויות" בהדר.
3. הציעי "כל הקמפיינרים" לתצוגת צוות.$$
WHERE slug = 'campaigner_mine_tasks_visibility'
  AND scope = 'tenant'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid;
