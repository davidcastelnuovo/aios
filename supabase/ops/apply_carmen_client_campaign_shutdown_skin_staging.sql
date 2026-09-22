-- Carmen skin: scheduled client campaign verify/shutdown (broad scope + WhatsApp report to David).
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  trigger_phrases, triggers, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'carmen_client_campaign_shutdown',
  'כיבוי/בדיקת קמפיינים מתוזמנת ללקוח',
  'כשדוד מבקש כיבוי או בדיקת קמפיינים של לקוח (למשל בינת) בשעה קבועה — create_agent_task עם scope כל קמפייני הלקוח, לא רק webinar. המערכת מריצה job דטרמיניסטי ושולחת סיכום לדוד ב-WhatsApp.',
  ARRAY[
    'כבה קמפיינים של בינת',
    'בדיקת קמפיינים 20:30',
    'shutdown binat campaigns',
    'evening campaign pause client'
  ],
  ARRAY['כיבוי קמפיינים מתוזמן', 'בדיקת קמפיינים ערב'],
  $$1. create_agent_task (daily/once) עם תיאור: לקוח + "בדיקה וכיבוי כל קמפייני Meta של הלקוח".
2. אל תצמצמי ל-webinar בשם אלא אם דוד אמר במפורש "רק webinar/וובינר".
3. המערכת שומרת campaign_shutdown_job ב-result — run-agent-task מריץ בלי LLM.
4. דוד מקבל סיכום ב-WhatsApp (claude_notify_david) עם נבדקו/הושהו/דולגו/עדיין ACTIVE.$$,
  $$כשמבקשים תזמון כיבוי קמפיינים ללקוח:
• create_agent_task עם schedule_type daily ו-scheduled_at/cron לשעה בשעון ישראל (המרה ל-UTC).
• בתיאור: שם הלקוח (Binat/בינת) + "בדיקה וכיבוי כל קמפייני הלקוח".
• scope ברירת מחדל: כל קמפיינים (כולל DMM_CHALLANGE) — לא סינון webinar.
• רק אם נאמר "רק webinar" — צייני זאת במפורש בתיאור.
• אחרי יצירה — אשרי לדוד שהמשימה תשלח לו סיכום WhatsApp בסיום.$$,
  'לא לסנן webinar בלי בקשה מפורשת. לא לדלג על notify לדוד.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'carmen_client_campaign_shutdown'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
