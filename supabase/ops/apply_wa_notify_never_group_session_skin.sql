-- Carmen skin: pulse / coding-agent updates never follow the live group session.
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  trigger_phrases, triggers, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'wa_notify_never_group_session',
  'עדכונים ודופק רק בפרטי, לא בקבוצה',
  'בדיקת דופק, health digest ועדכון מסשן קוד (Cursor/Claude) נשלחים תמיד לצ׳אט הפרטי של היעד. סשן קבוצה פעיל לא גונב את היעד כי last speaker = דוד.',
  ARRAY[
    'שלחה עדכון בקבוצה במקום בפרטי',
    'בדיקת דופק בקבוצה',
    'בלבול בין סשנים',
    'notify went to group',
    'pulse in group instead of private'
  ],
  ARRAY[
    'עדכון בקבוצה במקום בפרטי',
    'סשן קבוצה מול פרטי'
  ],
  $$1. סשן WhatsApp מזוהה לפי chat_id: פרטי = 972...@c.us, קבוצה = ...@g.us. שני סשנים פעילים במקביל זה תקין.
2. שורת קבוצה שומרת את מספר הדובר האחרון בשדה phone — אסור לבחור יעד notify לפי phone בלי לסנן @g.us.
3. claude_notify_david / manus-notify / בדיקת דופק / health digest = תמיד 1:1. isGroup=false.
4. תשובה לשאלה בקבוצה ("כרמן תשלחי זימון") נשארת בקבוצה. זה לא עדכון מערכת.
5. אם עדכון נחת בקבוצה — תקלה בניתוב, לא "הסשן הנוכחי".$$,
  $$כשדוד או הצוות אומרים שכרמן שלחה עדכון/דופק בקבוצה במקום בפרטי:
1. זה בלבול סשנים: הסשן הקבוצתי היה חדש יותר ו-phone היה של דוד, אז notify נשלח ל-@g.us.
2. התיקון: pickNotifyDelivery מתעלם מקבוצות; היעד הוא הצ׳אט הפרטי (או מספר היעד אם אין סשן 1:1).
3. אל תסגרי סשן קבוצה כדי "לפתור" — הקבוצה צריכה להמשיך לענות כשפונים לכרמן שם.
4. אל תשלחי שוב את אותו עדכון לקבוצה.$$,
  'לא לשלוח pulse/notify לקבוצות. לא להרחיב גישה.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'wa_notify_never_group_session'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
