-- Carmen skin: connect to existing automation + add WhatsApp send step (approval-gated).
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  trigger_phrases, triggers, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'carmen_automation_add_whatsapp_step',
  'הוספת מודול שליחת WhatsApp לאוטומציה קיימת',
  'מחברת צעד שליחת WhatsApp לאוטומציה קיימת דרך propose_automation_add_step — בלי למחוק צעדים קיימים.',
  ARRAY[
    'תוסיפי שליחת ווטסאפ לאוטומציה',
    'תחברי מודול whatsapp',
    'הוסיפי צעד green api',
    'add whatsapp step to automation',
    'שליחת whatsapp באוטומציה'
  ],
  ARRAY[
    'אוטומציה whatsapp',
    'מודול שליחה'
  ],
  $$1. list_automations / get_automation_details — אמתי אוטומציה לפי שם; אם כמה — שאלי.
2. list_integrations — בחרי חיבור WA נכון (לא לערבב Manus ו-Green API).
3. שאלי: ערוץ (Green/Manus / Meta / ManyChat), יעד (contact / טלפון / קבוצה), תבנית הודעה, מיקום בשרשרת.
4. propose_automation_add_step עם step מסוג action — לא propose_automation_edit (אלא אם מחליפים כל ה-flow במפורש).
5. הציגי סיכום + בקשי אישור → execute_pending_approval.
6. הזכירי לבדוק בעורך הויזואלי לפני toggle_automation active=true.$$,
  $$כשדוד מבקש להוסיף שליחת WhatsApp לאוטומציה קיימת:
1. get_automation_details — קראי configuration + propose_format לכל צעד.
2. בחרי action_type:
   - send_greenapi_message — Green API / Manus (CRM, לידים, התראות DMM)
   - send_meta_whatsapp_message — Meta הרשמי
   - send_whatsapp — ManyChat (התראת ליד DMM)
   - send_greenapi_to_campaigner — לקמפיינר
3. חוק חיבורים: אוטומציות כרמן (carmen_whatsapp_session) → manus_wa בלבד. CRM/לידים → green_api אופרטור. לא להחליף בין ערוצים.
4. config לדוגמה (Green API):
   { green_api_integration_id, greenapi_send_to_type: contact|manual_phone|manual_group, message_template }
   אחרי agent: message_template עם {{agent_output}}.
5. propose_automation_add_step — after_step_id ריק = בסוף השרשרת.
6. לא מפעילים ולא מוחקים צעדים בלי אישור מפורש.$$,
  'לא לערבב Manus ו-Green API. לא להפעיל אוטומציה בלי אישור. לא propose_automation_edit עם steps[] אלא אם דוד ביקש להחליף כל ה-flow.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'carmen_automation_add_whatsapp_step'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
