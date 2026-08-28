-- Carmen skin: "leads to blocked Manus groups" are Make.com → Green API, not Carmen/Manus.
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  trigger_phrases, triggers, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'lead_groups_are_make_greenapi_not_manus',
  'לידים לקבוצות וואטסאפ מגיעים מ-Make+Green API',
  'שליחת לידים לקבוצות לקוח רצה מ-Make.com על Green API (972507677613), לא מכרמן ולא מ-Manus WA. לא לעצור בלי אישור דוד.',
  ARRAY[
    'לידים לקבוצות שנחסמו במנוס',
    'שולחת הרבה לידים לקבוצות',
    'טריגר לידים לקבוצות וואטסאפ',
    'leads to blocked manus groups',
    'make green api whatsapp groups'
  ],
  ARRAY[
    'לידים לקבוצות וואטסאפ',
    'manus blocked groups leads'
  ],
  $$1. בדקי chat_messages: לידים לקבוצות = provider green_api, typeWebhook=outgoingAPIMessageReceived, instance 7103954455, שולח 972507677613.
2. Manus WA של כרמן הוא 972549696673 (instance YwIn7GY3Ul3OAxXG) — אין הודעות לקבוצות ב-3 הימים האחרונים.
3. האוטומציות ב-AIOS לקבוצות (מימד נוסף, פבליקו) פעילות אבל 0 הרצות — Make שולח ישירות ל-Green API.
4. האוטומציה "התראת ליד ללקוח מ-Make / Webhook" שולחת לטלפון לקוח (@c.us) דרך Manus DMM, לא לקבוצה.
5. כרמן / קבוצות פנימיות = תשובות בצוות, skipped carmen_owned_by_webhook — לא פאנ-אאוט לידים.
6. אל תכבי/תעצרי תרחישי Make או אוטומציות בלי אישור מפורש מדוד.$$,
  $$כשדוד או הצוות אומרים שכרמן שולחת לידים לקבוצות שנחסמו במנוס:
1. זה לא כרמן ולא Manus WA. זה Make.com (team 149002, eu2) עם מודול Green API (app#greenapi-nuycxg) על מופע 7103954455 / 972507677613.
2. ~123 תרחישי Make פעילים שולחים לקבוצות לקוח (מרינה, נופר, Thinka, Heritage, ToneLine, מימד נוסף, מרלוג, וכו').
3. קבוצות is_blocked ב-AIOS לא קיבלו outbound ב-7 הימים האחרונים. החסימה במנוס היא על האינסטנס האחר (כרמן 972549696673) שלא שולח לקבוצות.
4. לעצירה צריך להשהות תרחישי Make הרלוונטיים — לא אוטומציות AIOS. לשאול את דוד לפני כל עצירה.$$,
  'לא להשהות Make/אוטומציות/אינטגרציות בלי אישור דוד. לא להרחיב גישה.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'lead_groups_are_make_greenapi_not_manus'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
