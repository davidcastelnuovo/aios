# איחוד ספירת לידים בדוח פייסבוק

## הבעיה שזיהיתי
בקמפיינים של איריס גייר ("לידים מהאתר | מיגרנה / פיברו / עיכול / רימרקטינג") שיש להם objective = `OUTCOME_LEADS` ומפנים לעמוד נחיתה עם Facebook Pixel, ה-API של פייסבוק מחזיר בשדות `actions/conversions` **0** ב-:
- `leadgen_grouped` (טופס ליד) ✓ נכון, אין טופס ליד
- `offsite_conversion.fb_pixel_lead` (Lead event) ← אמור להיות מלא, אבל מוחזר 0
- `offsite_conversion.custom.*` (Custom Conversion) ← 0
- `lead` (aggregate) ← 0

הקוד הקיים (`supabase/functions/sync-facebook-insights/index.ts`) כבר תומך בכל אלה, אבל **לא** באירועי Pixel סטנדרטיים נוספים שפעמים רבות משמשים כ-"ליד" בעמודי נחיתה — `Complete Registration`, `Contact`, `Submit Application`, `Schedule`, `Subscribe` — וגם **לא מצרף הודעות (messaging)** למניין כשהקמפיין הוא OUTCOME_LEADS. בנוסף, חסרים לוגים מפורטים של ה-action_types שחוזרים מפייסבוק, מה שמקשה לאבחן למה היעד=0.

## מה אעשה (כל השינויים אך ורק ב-`supabase/functions/sync-facebook-insights/index.ts`)

### 1. הרחבת רשימת אירועי ה-Pixel שנספרים כליד
אוסיף ל-`leadActionTypes` ולחישוב הליד עצמו את האירועים הסטנדרטיים הבאים שכמעט תמיד מייצגים ליד אמיתי בעמוד נחיתה:

```text
complete_registration                              (legacy)
offsite_conversion.fb_pixel_complete_registration
omni_complete_registration
contact
offsite_conversion.fb_pixel_contact
submit_application
offsite_conversion.fb_pixel_submit_application
schedule
offsite_conversion.fb_pixel_schedule
subscribe
offsite_conversion.fb_pixel_subscribe
```

אלה אירועי ה-Standard Events של פייסבוק שמסמנים "המשתמש מילא טופס/השאיר פרטים/קבע פגישה". בעמוד נחיתה לרוב יורה אחד מהם במקום `Lead` הרגיל.

### 2. ספירה מאוחדת אמיתית לעמודת "לידים"
החישוב החדש (חליפי לחישוב הקיים בלבד עבור Lead Form / Messaging / Default — לא נוגע ב-ecommerce/traffic):

```text
unifiedLeads = MAX(
  aggregateLead,                               // FB's deduplicated 'lead'
  formLeads + pixelLeads + customLeads
    + extraStandardEventLeads                  // ← חדש (Complete Registration וכו׳)
    + messagingLeads                           // ← חדש: כל קמפיין, לא רק Engagement
)
```

עקרון: **MAX** ולא סכימה כפולה — כך פייסבוק מציג ב"Results", ובכל זאת אם ה-aggregate חסר נספור הכל ידנית כדי שלא נחמיץ.

זה משאיר את הסיווג הקיים של קמפיינים לקטגוריות (lead / ecommerce / traffic) **בדיוק כפי שהוא**, ומשפיע אך ורק על מספר הלידים שמוצג בעמודת "לידים" של טבלת קמפייני הלידים.

### 3. אבחון: לוגים מפורטים של action_types
כשמספר הלידים שיוצא הוא 0 אבל יש הוצאה > 0, אדפיס ל-log את **כל** ה-action_types שחזרו מפייסבוק עבור אותה שורה (campaign_name + date). זה יאפשר לראות מיד מה השם המדויק של אירוע ה-Pixel של איריס (אם זה custom conversion עם prefix לא רגיל) ולהוסיף אותו לרשימה ב-iteration הבא במקום לנחש.

### 4. הגנה על דוחות אחרים — מה *לא* משתנה
- סיווג קמפיינים ל-lead / ecommerce / traffic / other נשאר זהה
- חישוב `purchases`, `purchase_value`, `add_to_cart`, `roas`, `cost_per_purchase` — לא נוגע
- חישוב `lp_or_form_views`, `cost_per_lead` (תמיד spend/leads) — נשאר
- כללי `forceLeadsOnly` ב-`DynamicTableView.tsx` — לא נוגע
- דוחות Ahrefs / GSC / GA / Google Ads / WooCommerce — לא נוגע
- `getLeadsFromData` ב-`src/lib/adsMetrics.ts` — לא נוגע (זה רק בצד הקליינט וקורא את אותו שדה `leads` שעכשיו יהיה מאוחד)

### 5. הפצה ורענון
- אפרוס מחדש את הפונקציה
- ארענן את 30 הימים האחרונים של איריס גייר אוטומטית (`tableId=1f3bafb0-...`) כדי שהשינוי ייכנס מיד לתוקף
- אבדוק את הדוח שלה ואשלח עדכון אם עדיין 0 → אז נדע מה-log את שם ה-action_type המדויק שחסר ונוסיף אותו

## פירוט טכני (לקריאה מקצועית)

**קובץ יחיד שנערך:** `supabase/functions/sync-facebook-insights/index.ts` — בערך שורות 258-360.

תוספות:
```ts
const STANDARD_INTENT_LEAD_TYPES = [
  'complete_registration', 'offsite_conversion.fb_pixel_complete_registration', 'omni_complete_registration',
  'contact', 'offsite_conversion.fb_pixel_contact',
  'submit_application', 'offsite_conversion.fb_pixel_submit_application',
  'schedule', 'offsite_conversion.fb_pixel_schedule',
  'subscribe', 'offsite_conversion.fb_pixel_subscribe',
];

const _standardIntentValue = sumByTypes(STANDARD_INTENT_LEAD_TYPES);

// Unified leads — used for ALL non-ecommerce/non-traffic campaigns
const _summed =
  _formLeadsValue + _pixelLeadsValue + _customConversionLeadsValue
  + _standardIntentValue + _messagingLeadsValue;

leads = Math.max(_aggregateLeadValue, _summed);
```

ה-`leadActionTypes` (המשמש לסיווג קמפיין כ-"יש סיגנל ליד") יורחב באותם types כדי שקמפיין עם רק `Complete Registration` לא יסווג כ-`other`.

לוג חדש (רק כש-spend>0 וגם leads=0):
```ts
console.log('[sync-facebook-insights] ZERO leads despite spend', {
  campaign: insight.campaign_name, date: insight.date_start,
  spend, action_types: Array.from(actionTypeSet),
});
```

## אימות אחרי הפריסה
1. אריץ את הסנכרון לאיריס ל-30 ימים אחרונים
2. אקרא את `crm_records` של הטבלה ואוודא ש-`leads > 0` בקמפיינים שהוצאו עליהם כסף
3. אם עדיין 0 — אקרא את הלוגים של הפונקציה כדי למצוא את שם ה-action_type המדויק ואוסיף אותו

## מה לא בתוך תוכנית זו (אבל אפשר אחר כך)
- שיוך לידים מטבלת `leads` (Lead Ads webhook) ספציפית ללקוח לפי שם קמפיין/agency_id — דורש שינוי data-model נפרד
- הצגת לידים מ-Elementor/WordPress בדוח הפייסבוק — דורש קישור WordPress ללקוח (אין כרגע לאיריס)
- דאשבורד "כל הלידים מכל המקורות" מאוחד ללקוח — מודול חדש