-- Tenant skin: Carmen can add Meet/Zoom + attendees to existing Google Calendar events.
-- Staging apply via apply-staging-sql-migration.yml. Additive. Does not widen access.

INSERT INTO public.ai_skills
  (slug, scope, tenant_id, name, description, system_prompt, allowed_tools, triggers, trigger_phrases, is_active, steps, created_by_agent)
SELECT
  'calendar_conference_and_carmen_attendee',
  'tenant',
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'יומן — Meet/Zoom והזמנת כרמן',
  'עדכון פגישה קיימת ביומן Google: הוספת Google Meet (או Zoom אם מוגדר), והוספת מוזמנים כולל כרמן — בלי למחוק מוזמנים קיימים.',
  $$כשמבקשים להפוך פגישה לזום/מיט, להוסיף קישור וידאו, או להזמין את כרמן:

1. list_calendar_events עם search=שם הפגישה → קחי event_id. אל תמציאי event_id.
2. update_calendar_invite:
   - event_id (חובה)
   - add_conference=true
   - conference_type="zoom" אם ביקשו זום במפורש, אחרת Meet.
   - add_attendee_emails לרשימת מיילים נוספים (לא מחליף קיימים)
   - add_carmen=true כדי להוסיף את כרמן כמוזמנת. אם אין מייל ידוע — carmen_email.
3. בדקי את התשובה: חייבים conference_url כשמבקשים וידאו, ו-attendees המעודכנת.
4. אם zoom_available=false — אמרי שנוסף Google Meet כי Zoom לא מוגדר בטננט.
5. לצירוף כרמן כבוט תמלול בזמן הפגישה (לא רק מוזמנת ביומן): join_meeting_for_client עם meeting_url=conference_url.
6. אסור לומר שהפגישה הפכה לזום אם conference_type שחזר הוא meet.

כלים: list_calendar_events, update_calendar_invite, send_calendar_invite, join_meeting_for_client.$$,
  ARRAY['list_calendar_events','update_calendar_invite','send_calendar_invite','join_meeting_for_client'],
  ARRAY[
    'הפכי לזום','תהפכי לפגישת זום','Google Meet','הוסיפי קישור לפגישה','תזמיני את כרמן לפגישה',
    'add zoom to the meeting','make it a zoom meeting','invite carmen to the meeting','add meet link'
  ],
  ARRAY[
    'הפכי לזום','תהפכי לפגישת זום','Google Meet','הוסיפי קישור לפגישה','תזמיני את כרמן לפגישה',
    'add zoom to the meeting','make it a zoom meeting','invite carmen to the meeting','add meet link'
  ],
  true,
  $$1. list_calendar_events → event_id
2. update_calendar_invite(event_id, add_conference, conference_type, add_attendee_emails, add_carmen)
3. דווחי event_link + conference_url + attendees
4. אם צריך בוט תמלול: join_meeting_for_client(conference_url)$$,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills s
  WHERE s.slug = 'calendar_conference_and_carmen_attendee'
    AND s.tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
