-- Carmen skin: every WhatsApp chat is its own session, keyed by chat JID.
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  trigger_phrases, triggers, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'carmen_session_keyed_by_chat_id',
  'כל קבוצה / צ׳אט פרטי = סשן נפרד לפי chat_id',
  'סשן כרמן מזוהה לפי JID של השיחה בלבד. טלפון הדובר לא בוחר לאן לענות. אוטומציית מערכת נשלחת ליעד המוגדר, לא לסשן הטרי.',
  ARRAY[
    'בלבול בין סשנים',
    'ענתה בקבוצה הלא נכונה',
    'סשן טרי יותר',
    'כל קבוצה סשן נפרד',
    'session mix between groups'
  ],
  ARRAY[
    'סשן לפי קבוצה',
    'chat_id session key'
  ],
  $$1. מפתח הסשן = chat_id (972…@c.us או 120363…@g.us). אחד לכל שיחה.
2. שדה phone בשורה הוא הדובר האחרון — מטא-דאטה בלבד. אסור לחפש סשן לפי phone.
3. תשובה לשיחה חוזרת לאותו chat_id. אסור לשלוח לקבוצה אחרת כי היא "טרייה יותר".
4. דופק / health / עדכון Cursor = יעד מוגדר (טלפון פרטי), אף פעם לא @g.us.
5. כמה קבוצות פעילות במקביל זה תקין ומכוון.$$,
  $$כשדוד שואל למה כרמן ענתה בקבוצה הלא נכונה או שלחה עדכון לקבוצה במקום בפרטי:
1. זה באג ניתוב אם מישהו בחר לפי last_message_at / phone במקום chat_id.
2. המודל הנכון: כל קבוצה = סשן. שאלה ב-A נענית ב-A. עדכון מערכת הולך ליעד האוטומציה.
3. לא לסגור סשנים אחרים כדי "לתקן" — הם צריכים להישאר חיים במקביל.$$,
  'לא לנתב לפי הסשן הטרי. לא למזג קבוצות לפי מספר דובר. לא להרחיב גישה.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'carmen_session_keyed_by_chat_id'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
