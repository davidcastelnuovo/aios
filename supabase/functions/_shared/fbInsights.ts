// Shared Facebook Insights → CRM record logic.
//
// Both `sync-facebook-insights` (manual "sync now") and
// `cron-sync-facebook-insights` (the scheduled job that populates the report)
// MUST use this single implementation so their lead-counting can never drift
// again. They previously diverged: the manual function was fixed to recognise
// `offsite_conversion.fb_pixel_custom.*` custom conversions (e.g. "NewLead",
// "Lead_Bidul") while the cron kept an older matcher that only caught the legacy
// `offsite_conversion.custom.*` prefix — so website-lead campaigns optimised on a
// custom conversion were silently counted as 0 leads in the synced report.

export interface CampaignStatus {
  id: string;
  name: string;
  effective_status: string;
  configured_status: string;
  objective?: string | null;
  updated_time?: string | null;
}

export interface InsightRecord {
  date: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  lp_or_form_views: number;
  cpm: number;
  ctr: number;
  leads: number;
  form_leads: number;
  cost_per_lead: number;
  spend: number;
  purchases: number;
  purchase_value: number;
  add_to_cart: number;
  roas: number;
  campaign_objective: string | null;
  campaign_type: 'lead' | 'ecommerce' | 'traffic' | 'other';
  effective_status?: string | null;
  configured_status?: string | null;
  updated_time?: string | null;
}

// Field schema for the Facebook Insights CRM table (keys / Hebrew names / types),
// kept here so both sync functions create exactly the same columns.
export const FB_INSIGHTS_FIELD_KEYS = ['date', 'campaign_name', 'campaign_id', 'impressions', 'clicks', 'lp_or_form_views', 'cpm', 'ctr', 'leads', 'form_leads', 'cost_per_lead', 'spend', 'purchases', 'purchase_value', 'add_to_cart', 'roas', 'campaign_objective', 'campaign_type', 'effective_status', 'configured_status', 'updated_time'];
export const FB_INSIGHTS_FIELD_NAMES = ['תאריך', 'שם הקמפיין', 'מזהה קמפיין', 'חשיפות', 'קליקים', 'צפיות LP / פתיחות טופס', 'עלות ל-1000 חשיפות', 'אחוז קליקים', 'לידים', 'לידים מטופס', 'עלות לליד', 'הוצאה', 'רכישות', 'ערך רכישות', 'הוספות לעגלה', 'ROAS', 'מטרת קמפיין', 'סוג קמפיין', 'סטטוס בפועל', 'סטטוס מוגדר', 'עדכון אחרון בקמפיין'];
export const FB_INSIGHTS_FIELD_TYPES = ['date', 'text', 'text', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'text', 'text', 'text', 'text', 'text'];

// Standard FB Pixel "intent" events that landing pages frequently use INSTEAD of
// the standard `Lead` event — each means "user submitted info / asked to be
// contacted / scheduled / subscribed". We treat them as leads.
export const STANDARD_INTENT_LEAD_TYPES = [
  'complete_registration',
  'offsite_conversion.fb_pixel_complete_registration',
  'omni_complete_registration',
  'contact',
  'offsite_conversion.fb_pixel_contact',
  'submit_application',
  'offsite_conversion.fb_pixel_submit_application',
  'schedule',
  'offsite_conversion.fb_pixel_schedule',
  'subscribe',
  'offsite_conversion.fb_pixel_subscribe',
];

export const LEAD_ACTION_TYPES = [
  'lead', // Aggregate lead count
  'leadgen_grouped', 'leadgen.other', // Facebook Lead Forms
  'offsite_conversion.fb_pixel_lead', // Landing page leads (standard pixel event)
  'onsite_conversion.lead_grouped', // On-site leads
  'app_custom_event.fb_mobile_lead', // App leads
  ...STANDARD_INTENT_LEAD_TYPES,
  // WhatsApp / Messaging conversions
  'onsite_conversion.messaging_conversation_started_7d',
  'messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'messaging_first_reply',
];

// Facebook returns the same conversion under multiple action_types (e.g.
// 'purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase' all refer
// to the same event). Summing all of them inflates 2-3x vs the Ads Manager UI,
// so we pick ONE canonical type per metric, with fallbacks.
const PURCHASE_ACTION_TYPE_PRIORITY = [
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'purchase',
];
const ADD_TO_CART_ACTION_TYPE_PRIORITY = [
  'omni_add_to_cart',
  'offsite_conversion.fb_pixel_add_to_cart',
  'add_to_cart',
];

/**
 * Resolve the EXACT action_type(s) Facebook counts as a campaign's "Result",
 * from an ad set's `promoted_object` + `optimization_goal`. This is what makes
 * the report match Ads Manager: instead of guessing across all lead-ish events
 * (and picking the broad `fb_pixel_lead` over the campaign's real optimized
 * event), we count only the event the campaign is actually optimized for.
 *
 * Returns an array of equivalent action_types (count = MAX across them), or
 * null when it can't be determined (caller falls back to the heuristic).
 */
/** Extract a custom pixel event name from a promoted_object `pixel_rule` JSON
 *  string, e.g. {"event":{"eq":"NewLead"}} → "NewLead". Returns null if none. */
function extractPixelRuleEvent(pixelRule: any): string | null {
  if (!pixelRule) return null;
  try {
    const s = typeof pixelRule === 'string' ? pixelRule : JSON.stringify(pixelRule);
    const m = s.match(/"event"\s*:\s*\{\s*"eq"\s*:\s*"([^"]+)"/) || s.match(/"event"\s*:\s*"([^"]+)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function resolveResultLeadTypes(
  promotedObject: any,
  optimizationGoal?: string | null,
  objective?: string | null,
): string[] | null {
  const po = promotedObject || {};
  const goal = String(optimizationGoal || '').toUpperCase();
  const obj = String(objective || '').toUpperCase();
  const cet = String(po.custom_event_type || '').toUpperCase();

  // 1) Pixel Custom Conversion rule (optimized for a specific custom conversion).
  if (po.custom_conversion_id) {
    return ['offsite_conversion.fb_pixel_custom.' + po.custom_conversion_id];
  }
  // 2) Custom pixel event (e.g. trackCustom('NewLead')) — the common case here.
  //    Meta exposes the event name either as `custom_event_str` or embedded in
  //    the `pixel_rule` JSON ({"event":{"eq":"NewLead"}}). Handle both.
  if (cet === 'OTHER' || cet === '' || cet === 'CONTENT_VIEW') {
    const name = po.custom_event_str || extractPixelRuleEvent(po.pixel_rule);
    if (name) return ['offsite_conversion.fb_pixel_custom.' + name];
  }
  // 3) Standard pixel events, mapped to their insights action_type.
  const STD: Record<string, string[]> = {
    LEAD: ['offsite_conversion.fb_pixel_lead'],
    COMPLETE_REGISTRATION: ['offsite_conversion.fb_pixel_complete_registration', 'complete_registration'],
    CONTACT: ['offsite_conversion.fb_pixel_contact', 'contact'],
    SCHEDULE: ['offsite_conversion.fb_pixel_schedule', 'schedule'],
    SUBMIT_APPLICATION: ['offsite_conversion.fb_pixel_submit_application', 'submit_application'],
    SUBSCRIBE: ['offsite_conversion.fb_pixel_subscribe', 'subscribe'],
  };
  if (STD[cet]) return STD[cet];
  // PURCHASE / sales optimization is not a lead — let the caller handle it.
  if (cet === 'PURCHASE') return null;

  // 4) No pixel event: on-Facebook instant Lead Form.
  if (goal === 'LEAD_GENERATION' || goal === 'QUALITY_LEAD') {
    return ['leadgen_grouped', 'leadgen.other', 'onsite_conversion.lead_grouped'];
  }
  // 5) Messaging / conversations.
  if (goal === 'CONVERSATIONS' || obj === 'OUTCOME_ENGAGEMENT' || obj === 'MESSAGES') {
    return ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d'];
  }
  return null;
}

/**
 * Build campaign_id → result action_type(s) map from a list of ad sets
 * (each `{ campaign_id, optimization_goal, promoted_object }`). Keeps the first
 * resolvable result per campaign. `campaignObjectives` supplies the campaign
 * objective as a fallback signal for the resolver.
 */
export function buildResultLeadTypeMap(
  adsets: any[],
  campaignObjectives: Record<string, string | null | undefined> = {},
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const as of adsets || []) {
    const cid = String(as?.campaign_id || '');
    if (!cid || map[cid]) continue;
    const types = resolveResultLeadTypes(as?.promoted_object, as?.optimization_goal, campaignObjectives[cid]);
    if (types && types.length > 0) map[cid] = types;
  }
  return map;
}

/**
 * Build a single CRM InsightRecord from one Facebook insights row (one
 * campaign × day). `campaignStatuses` maps campaign_id → status/objective.
 * `resultLeadTypesByCampaign` (optional) maps campaign_id → the exact result
 * action_type(s) from `buildResultLeadTypeMap`; when present for a campaign it
 * is authoritative and makes leads match Ads Manager's "Results" exactly.
 */
export function buildInsightRecord(
  insight: any,
  campaignStatuses: Record<string, CampaignStatus>,
  resultLeadTypesByCampaign: Record<string, string[]> = {},
): InsightRecord {
  const allActions = [...(insight.actions ?? []), ...(insight.conversions ?? [])];
  const actionValues = insight.action_values ?? [];
  const actionTypeSet = new Set(allActions.map((a: any) => String(a.action_type || '')));

  const getActionCount = (actionTypes: string[]) =>
    allActions
      .filter((a: any) => actionTypes.includes(String(a.action_type || '')))
      .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);

  const getActionValue = (actionTypes: string[]) =>
    actionValues
      .filter((a: any) => actionTypes.includes(String(a.action_type || '')))
      .reduce((sum: number, a: any) => sum + (parseFloat(a.value) || 0), 0);

  // Lead counting — objective-aware, matches Facebook Ads Manager "Results".
  // CRITICAL: never sum aggregate `lead` with specific lead types — FB's `lead`
  // is itself an aggregate of leadgen + pixel + messaging, so that double counts.
  const sumByTypes = (types: string[]) =>
    allActions
      .filter((a: any) => types.includes(String(a.action_type || '')))
      .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);

  const _campaignStatusForLeads = campaignStatuses[insight.campaign_id];
  const _objectiveForLeads = String(_campaignStatusForLeads?.objective || '').toUpperCase();
  const _isLeadFormObjective = ['OUTCOME_LEADS', 'LEAD_GENERATION'].includes(_objectiveForLeads);
  const _isMessagingObjective = ['OUTCOME_ENGAGEMENT', 'MESSAGES'].includes(_objectiveForLeads);

  const _formLeadsValue = sumByTypes(['leadgen.other', 'leadgen_grouped', 'onsite_conversion.lead_grouped']);
  const _messagingLeadsValue = sumByTypes([
    'onsite_conversion.messaging_conversation_started_7d',
    'messaging_conversation_started_7d',
  ]);
  const _pixelLeadsValue = sumByTypes(['offsite_conversion.fb_pixel_lead']);
  // Custom Conversions on the Pixel.
  // FB returns BOTH a parent aggregate (`offsite_conversion.custom` or
  // `offsite_conversion.fb_pixel_custom` — exact match, no suffix) AND each child
  // custom conversion (e.g. `offsite_conversion.fb_pixel_custom.NewLead`). The
  // parent equals the sum of children, so we sum CHILDREN only to avoid double
  // counting. We accept both `offsite_conversion.custom.*` (legacy) and
  // `offsite_conversion.fb_pixel_custom.*` (current) prefixes. Fall back to the
  // PARENT aggregate when FB returns no children.
  const _customChildrenValue = allActions
    .filter((a: any) => {
      const t = String(a.action_type || '');
      return (
        t.startsWith('offsite_conversion.custom.') ||
        t.startsWith('offsite_conversion.fb_pixel_custom.')
      );
    })
    .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);
  const _customParentValue = sumByTypes([
    'offsite_conversion.fb_pixel_custom',
    'offsite_conversion.custom',
  ]);
  const _customConversionLeadsValue = _customChildrenValue > 0
    ? _customChildrenValue
    : _customParentValue;
  // Standard intent events fired on landing pages (Complete Registration / etc.)
  const _standardIntentValue = sumByTypes(STANDARD_INTENT_LEAD_TYPES);

  // FB's aggregate `lead` action_type is the deduplicated total across all lead
  // sources (form + pixel + custom). Use it as a final fallback.
  const _aggregateLeadValue = sumByTypes(['lead']);

  // Single-source leads — match Ads Manager per campaign; never sum form + pixel
  // for the same campaign. MAX across pixel signals because FB reports the same
  // conversion under multiple action_types (fb_pixel_lead AND a custom
  // conversion); summing would double count.
  //
  // OUTCOME_LEADS can optimise for EITHER a Facebook Lead Form OR website pixel
  // leads ("לידים מהאתר") — use whichever signal actually fired.
  const _websiteLeads = Math.max(
    _pixelLeadsValue,
    _customConversionLeadsValue,
    _standardIntentValue,
  );

  // AUTHORITATIVE PATH: when we know the exact event this campaign is optimized
  // for (from the ad set's promoted_object), count only that event — this is
  // what Facebook shows in the "Results" column. Avoids inflating by counting
  // the broad fb_pixel_lead, or by summing several custom events.
  const _resultTypes = resultLeadTypesByCampaign[String(insight.campaign_id || '')];
  let leads: number;
  let _leadsAuthoritative = false;
  if (_resultTypes && _resultTypes.length > 0) {
    leads = Math.max(0, ..._resultTypes.map((t) => sumByTypes([t])));
    _leadsAuthoritative = true;
  } else if (_isMessagingObjective) {
    leads = _messagingLeadsValue > 0 ? _messagingLeadsValue : _websiteLeads;
  } else if (_isLeadFormObjective) {
    // Prefer real form submissions; if the "Leads" campaign actually drives to a
    // website (pixel), use the pixel value instead of reporting 0.
    leads = _formLeadsValue > 0 ? _formLeadsValue : _websiteLeads;
  } else {
    // Conversions / Sales / Traffic with pixel — website leads.
    leads = _websiteLeads > 0 ? _websiteLeads : _formLeadsValue;
  }
  // Final fallback: FB's deduplicated aggregate `lead` total. Never override an
  // authoritative 0 (FB genuinely reported no results for the optimized event).
  if (!_leadsAuthoritative && leads === 0) leads = _aggregateLeadValue;

  const _spendForLog = parseFloat(insight.spend) || 0;
  if (leads === 0 && _spendForLog > 0) {
    console.log('[fbInsights] ZERO leads despite spend', {
      campaign: insight.campaign_name,
      campaign_id: insight.campaign_id,
      date: insight.date_start,
      spend: _spendForLog,
      objective: _objectiveForLeads,
      action_types: Array.from(actionTypeSet),
    });
  }
  const _leadgenGroupedValue = _formLeadsValue;

  // Landing page views (website campaigns) vs form opens (Lead Form campaigns).
  const landingPageViews = allActions
    .filter((a: any) => String(a.action_type || '') === 'landing_page_view')
    .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);
  const formOpens = allActions
    .filter((a: any) => {
      const type = String(a.action_type || '');
      return type === 'leadgen_form_opened' || type === 'lead_form_open';
    })
    .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);
  const leadFormLeads = allActions
    .filter((a: any) => String(a.action_type || '') === 'leadgen_grouped')
    .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);
  const isLeadFormCampaign = leadFormLeads > 0 || formOpens > 0;
  const lpOrFormViews = isLeadFormCampaign ? formOpens : landingPageViews;

  // Cost per lead — always spend / leads for accuracy (matches FB aggregation).
  const spend = parseFloat(insight.spend) || 0;
  const costPerLead = leads > 0 ? spend / leads : 0;

  // Pick the first matching action_type (deduplicated) to mirror Ads Manager's
  // "Purchases" column instead of summing duplicate types.
  const pickFirstAvailable = (priority: string[]) => {
    for (const type of priority) {
      if (actionTypeSet.has(type)) return [type];
    }
    return [];
  };
  const effectivePurchaseTypes = pickFirstAvailable(PURCHASE_ACTION_TYPE_PRIORITY);
  const effectiveAddToCartTypes = pickFirstAvailable(ADD_TO_CART_ACTION_TYPE_PRIORITY);

  const purchases = getActionCount(effectivePurchaseTypes);
  const purchaseValue = getActionValue(effectivePurchaseTypes);
  const addToCart = getActionCount(effectiveAddToCartTypes);
  const roas = spend > 0 ? purchaseValue / spend : 0;

  const campaignStatus = campaignStatuses[insight.campaign_id];
  const objective = String(campaignStatus?.objective || '').toUpperCase();
  const isEcommerceObjective = ['OUTCOME_SALES', 'PRODUCT_CATALOG_SALES', 'SALES'].includes(objective);
  const isLeadObjective = ['OUTCOME_LEADS', 'LEAD_GENERATION'].includes(objective);
  const isMessagingObjective = ['OUTCOME_ENGAGEMENT', 'MESSAGES'].includes(objective);
  const isTrafficObjective = ['OUTCOME_TRAFFIC', 'LINK_CLICKS', 'TRAFFIC'].includes(objective);

  const messagingActionTypes = [
    'onsite_conversion.messaging_conversation_started_7d',
    'messaging_conversation_started_7d',
    'onsite_conversion.messaging_first_reply',
    'messaging_first_reply',
  ];
  const hasMessagingSignal = messagingActionTypes.some((type) => actionTypeSet.has(type));

  const hasEcommerceSignal =
    purchases > 0 ||
    purchaseValue > 0 ||
    PURCHASE_ACTION_TYPE_PRIORITY.some((type) => actionTypeSet.has(type));
  // add_to_cart alone is NOT enough — lead campaigns can have incidental ATC.
  const hasStrongEcommerceSignal = hasEcommerceSignal || isEcommerceObjective;
  const hasLeadSignal =
    leads > 0 ||
    LEAD_ACTION_TYPES.some((type) => actionTypeSet.has(type)) ||
    Array.from(actionTypeSet).some((type) => String(type).startsWith('offsite_conversion.custom') || String(type).startsWith('offsite_conversion.fb_pixel_custom'));

  // PRIORITY: Campaign objective is the source of truth. Traffic campaigns get
  // their own type so they're not shown as lead campaigns with "0 leads".
  const campaignType: 'lead' | 'ecommerce' | 'traffic' | 'other' =
    isTrafficObjective
      ? 'traffic'
      : isLeadObjective
        ? 'lead'
        : isMessagingObjective && hasMessagingSignal
          ? 'lead'
          : isEcommerceObjective
            ? 'ecommerce'
            : hasStrongEcommerceSignal && !(hasLeadSignal && purchases === 0 && purchaseValue === 0)
              ? 'ecommerce'
              : hasLeadSignal
                ? 'lead'
                : addToCart > 0 || ADD_TO_CART_ACTION_TYPE_PRIORITY.some((type) => actionTypeSet.has(type))
                  ? 'ecommerce'
                  : 'other';

  return {
    date: insight.date_start,
    campaign_id: insight.campaign_id,
    campaign_name: insight.campaign_name,
    impressions: parseInt(insight.impressions) || 0,
    clicks: parseInt(insight.clicks) || 0,
    lp_or_form_views: lpOrFormViews,
    cpm: parseFloat(insight.cpm) || 0,
    ctr: parseFloat(insight.ctr) || 0,
    leads,
    form_leads: _leadgenGroupedValue,
    cost_per_lead: costPerLead,
    spend: parseFloat(insight.spend) || 0,
    purchases,
    purchase_value: purchaseValue,
    add_to_cart: addToCart,
    roas,
    campaign_objective: campaignStatus?.objective || null,
    campaign_type: campaignType,
    effective_status: campaignStatus?.effective_status || null,
    configured_status: campaignStatus?.configured_status || null,
    updated_time: campaignStatus?.updated_time || null,
  };
}
