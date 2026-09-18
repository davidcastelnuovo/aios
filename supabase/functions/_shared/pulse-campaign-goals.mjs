const DAY_MS = 86_400_000

export const PULSE_CAMPAIGN_GOALS = ['leads', 'engagement', 'ecommerce']

const PAUSED_DELIVERY_STATUSES = new Set([
  'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'AD_PAUSED',
])
const ACTIVE_DELIVERY_STATUSES = new Set([
  'ACTIVE', 'ENABLED', 'ELIGIBLE', 'LIMITED', 'LEARNING',
])
const REMOVED_DELIVERY_STATUSES = new Set([
  'REMOVED', 'DELETED', 'ARCHIVED', 'DISAPPROVED',
])

export function resolveCampaignDeliveryStatus(data = {}, integrationSettings = {}) {
  const raw = String(
    data.effective_status
    || data.configured_status
    || data.campaign_status
    || data.status
    || '',
  ).trim().toUpperCase()
  if (raw) {
    if (PAUSED_DELIVERY_STATUSES.has(raw) || raw.includes('PAUSED')) return 'paused'
    if (ACTIVE_DELIVERY_STATUSES.has(raw)) return 'active'
    if (REMOVED_DELIVERY_STATUSES.has(raw)) return 'removed'
    return 'other'
  }
  const campaignId = String(data.campaign_id || data.campaignId || '')
  const states = integrationSettings.operational_campaign_states
  if (campaignId && states && typeof states === 'object') {
    const state = states[campaignId]
    const status = String(state?.status || '').toUpperCase()
    if (status === 'PAUSED') return 'paused'
    if (status === 'ENABLED') return 'active'
    if (status === 'REMOVED') return 'removed'
  }
  return 'unknown'
}

export function campaignDeliveryStatusLabel(status) {
  if (status === 'active') return 'פעיל'
  if (status === 'paused') return 'מושהה'
  if (status === 'removed') return 'הוסר'
  if (status === 'other') return 'לא פעיל'
  return 'לא ידוע'
}

const LEAD_TERMS = ['LEAD', 'CONTACT', 'SUBMIT_APPLICATION', 'QUALIFIED_LEAD']
const ENGAGEMENT_TERMS = [
  'ENGAGEMENT', 'TRAFFIC', 'VIDEO_VIEW', 'THRUPLAY', 'MESSAGE', 'CONVERSATION',
  'REACH', 'AWARENESS', 'LINK_CLICK', 'LANDING_PAGE_VIEW',
]
const ECOMMERCE_TERMS = ['ECOMMERCE', 'PURCHASE', 'SALES', 'CONVERSION_VALUE', 'ROAS']

function normalizedTerms(...values) {
  return values
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).trim().toUpperCase())
    .filter(Boolean)
}

function includesTerm(values, terms) {
  return values.some((value) => terms.some((term) => value.includes(term)))
}

const META_OBJECTIVE_GOAL = [
  ['ecommerce', ['OUTCOME_SALES', 'PRODUCT_CATALOG_SALES', 'CATALOG_SALES']],
  ['leads', ['OUTCOME_LEADS', 'LEAD_GENERATION']],
  ['engagement', [
    'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS',
    'LINK_CLICKS', 'MESSAGES', 'REACH', 'VIDEO_VIEWS',
  ]],
]

function goalFromListedObjective(objective) {
  const normalized = String(objective || '').trim().toUpperCase()
  if (!normalized) return null
  for (const [goal, tokens] of META_OBJECTIVE_GOAL) {
    if (tokens.some((token) => normalized === token || normalized.includes(token))) return goal
  }
  return null
}

function goalFromResultKind(resultKind) {
  const kind = String(resultKind || '').trim().toLowerCase()
  if (!kind) return null
  if (kind === 'purchases') return 'ecommerce'
  if (kind === 'leads') return 'leads'
  if (['video_views', 'conversations', 'engagements', 'link_clicks', 'landing_page_views', 'results'].includes(kind)) {
    return 'engagement'
  }
  return null
}

/** Legacy synced rows may lack objective/result_kind but still carry report metrics. */
function goalFromSyncedRowMetrics(data = {}) {
  const purchases = Number(data.purchases ?? data.purchase ?? 0) || 0
  const purchaseValue = Number(data.purchase_value ?? data.conversions_value ?? data.revenue ?? 0) || 0
  if (purchases > 0 || purchaseValue > 0) return 'ecommerce'

  const leads = Number(data.leads ?? data.form_leads ?? data.conversions ?? 0) || 0
  const conversations = Number(data.conversations ?? data.messages ?? 0) || 0
  const videoViews = Number(data.video_views ?? data.thruplays ?? 0) || 0
  if (conversations > 0 || videoViews > 0) return 'engagement'
  if (leads > 0) return 'leads'

  return null
}

function goalFromCampaignName(name) {
  const raw = String(name || '').trim()
  if (!raw) return null
  if (/מכירות|sales|purchase|רכיש/i.test(raw)) return 'ecommerce'
  if (/מעורבות|סרטון|video|thruplay|ווטסאפ|whatsapp|message|שיח/i.test(raw)) return 'engagement'
  if (/ליד|lead/i.test(raw)) return 'leads'
  return null
}

function goalFromOptimizationGoal(optimizationGoal) {
  const normalized = String(optimizationGoal || '').trim().toUpperCase()
  if (!normalized) return null
  if (includesTerm([normalized], ECOMMERCE_TERMS) || normalized.includes('PURCHASE') || normalized.includes('VALUE')) {
    return 'ecommerce'
  }
  if (includesTerm([normalized], LEAD_TERMS)) return 'leads'
  if (includesTerm([normalized], ENGAGEMENT_TERMS)) return 'engagement'
  return null
}

function goalFromDerivedCampaignType(campaignType) {
  const normalized = String(campaignType || '').trim().toLowerCase()
  if (normalized === 'ecommerce') return 'ecommerce'
  if (normalized === 'traffic') return 'engagement'
  if (normalized === 'lead') return 'leads'
  return null
}

/** Report/table configuration — not a per-campaign guess. */
export function tableReportGoal(table = {}) {
  const integrationType = table.integration_type
  const settings = table.integration_settings || {}
  const category = String(table.category || '').trim()
  if (integrationType === 'facebook_ecommerce') return 'ecommerce'
  if (category === 'איקומרס') return 'ecommerce'
  const tableCampaignType = String(settings.campaign_type || '').trim().toLowerCase()
  if (tableCampaignType === 'ecommerce') return 'ecommerce'
  if (integrationType === 'facebook_insights' || integrationType === 'google_ads') return 'leads'
  return null
}

/** Single source of truth for “is this CRM table an ecommerce report?” */
export function isEcommerceReportTable(table = {}) {
  if (table.integration_type === 'facebook_ecommerce') return true
  if (String(table.category || '').trim() === 'איקומרס') return true
  return String(table.integration_settings?.campaign_type || '').trim().toLowerCase() === 'ecommerce'
}

/** Table-level default goal for pulse rollups (not per-campaign). */
export function integrationTypeToGoal(integrationType, table) {
  if (table && isEcommerceReportTable(table)) return 'ecommerce'
  if (integrationType === 'facebook_ecommerce') return 'ecommerce'
  if (integrationType === 'facebook_insights' || integrationType === 'google_ads') return 'leads'
  return null
}

/** Map stored pulse breakdown / snapshot row back to classifier input. */
export function classificationDataFromStoredRow(row = {}) {
  if (row.data && typeof row.data === 'object') return row.data
  return {
    campaign_objective: row.campaign_objective ?? row.objective ?? null,
    objective: row.campaign_objective ?? row.objective ?? null,
    optimization_goal: row.optimization_goal ?? null,
    campaign_type: row.campaign_type_hint ?? row.campaign_type ?? null,
    result_kind: row.result_kind ?? row.outcome_kind ?? null,
    campaign_name: row.campaign_name ?? null,
    pulse_goal: row.pulse_goal ?? null,
    campaign_goal: row.campaign_goal ?? null,
  }
}

function tableReportDefaultGoal(context = {}) {
  const goal = tableReportGoal(context)
  return goal === 'leads' ? null : goal
}

function classificationContext(context = {}) {
  return {
    integration_type: context.integration_type || null,
    integration_settings: context.integration_settings || {},
    category: context.category || null,
  }
}

/** Classify by campaign objective first; fall back to report type only when unknown. */
export function classifyPulseCampaignGoal(data = {}, context = {}) {
  const ctx = classificationContext(context)

  const objectiveGoal = goalFromListedObjective(data.campaign_objective || data.objective)
  if (objectiveGoal) return { goal: objectiveGoal, source: 'platform_goal' }

  const optimizationGoal = goalFromOptimizationGoal(data.optimization_goal)
  if (optimizationGoal) return { goal: optimizationGoal, source: 'platform_goal' }

  const resultKindGoal = goalFromResultKind(data.result_kind)
  if (resultKindGoal) return { goal: resultKindGoal, source: 'platform_goal' }

  const syncedMetricsGoal = goalFromSyncedRowMetrics(data)
  if (syncedMetricsGoal) return { goal: syncedMetricsGoal, source: 'platform_goal' }

  const platform = normalizedTerms(
    data.conversion_action_category,
    data.bidding_strategy_type,
  )
  if (includesTerm(platform, ECOMMERCE_TERMS)) {
    return { goal: 'ecommerce', source: 'platform_goal' }
  }
  if (includesTerm(platform, LEAD_TERMS)) {
    return { goal: 'leads', source: 'platform_goal' }
  }
  if (includesTerm(platform, ENGAGEMENT_TERMS)) {
    return { goal: 'engagement', source: 'platform_goal' }
  }

  const manual = normalizedTerms(data.pulse_goal, data.campaign_goal)
  if (includesTerm(manual, ECOMMERCE_TERMS)) {
    return { goal: 'ecommerce', source: 'explicit_mapping' }
  }
  if (includesTerm(manual, LEAD_TERMS)) {
    return { goal: 'leads', source: 'explicit_mapping' }
  }
  if (includesTerm(manual, ENGAGEMENT_TERMS)) {
    return { goal: 'engagement', source: 'explicit_mapping' }
  }

  const reportDefault = tableReportDefaultGoal(ctx)
  const nameGoal = goalFromCampaignName(data.campaign_name)
  if (nameGoal) return { goal: nameGoal, source: 'explicit_mapping' }

  const derived = goalFromDerivedCampaignType(data.campaign_type)
  if (derived) {
    // Ecommerce report tables: ignore fbInsights "lead" heuristic unless objective confirms leads.
    if (
      derived === 'leads'
      && reportDefault === 'ecommerce'
      && !objectiveGoal
      && !optimizationGoal
    ) {
      return { goal: reportDefault, source: 'table_report_type' }
    }
    return { goal: derived, source: 'explicit_mapping' }
  }

  if (reportDefault) return { goal: reportDefault, source: 'table_report_type' }

  return { goal: 'unknown', source: 'unclassified' }
}

function firstPresent(data, fields) {
  for (const field of fields) {
    if (data[field] !== null && data[field] !== undefined && data[field] !== '') {
      const value = Number(data[field])
      if (Number.isFinite(value)) return { value, field }
    }
  }
  return { value: null, field: null }
}

export function pulseCampaignOutcome(data = {}, goal = 'unknown') {
  if (goal === 'ecommerce') {
    const result = firstPresent(data, ['purchases', 'purchase', 'transactions'])
    return { ...result, kind: result.field ? 'purchases' : null }
  }
  if (goal === 'leads') {
    const result = firstPresent(data, [
      'leads', 'verified_leads', 'form_leads', 'website_leads', 'conversions',
    ])
    return { ...result, kind: result.field ? 'leads' : null }
  }
  if (goal === 'engagement') {
    const candidates = [
      ['conversations', 'conversations'],
      ['messages', 'messages'],
      ['video_views', 'video_views'],
      ['thruplays', 'video_views'],
      ['post_engagements', 'engagements'],
      ['engagements', 'engagements'],
      ['results', 'results'],
      ['result', 'results'],
      ['landing_page_views', 'landing_page_views'],
      ['lp_or_form_views', 'landing_page_views'],
      ['link_clicks', 'link_clicks'],
      ['clicks', 'clicks'],
    ]
    for (const [field, kind] of candidates) {
      const result = firstPresent(data, [field])
      if (result.field) return { ...result, kind }
    }
  }
  return { value: null, field: null, kind: null }
}

function utcDate(ymd) {
  const [year, month, day] = String(ymd).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function ymd(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS)
}

export function pulseTrendWindows(nowYmd) {
  const today = utcDate(nowYmd)
  const end = addDays(today, -1)
  const current3Start = addDays(end, -2)
  const current7Start = addDays(end, -6)
  return {
    current3: { start: ymd(current3Start), end: ymd(end) },
    current7: { start: ymd(current7Start), end: ymd(end) },
    baseline: { start: ymd(addDays(current7Start, -28)), end: ymd(addDays(current7Start, -1)) },
    today: ymd(today),
    queryStart: ymd(addDays(current7Start, -28)),
    queryEnd: ymd(today),
  }
}

function numberValue(data, fields) {
  return firstPresent(data, fields).value ?? 0
}

function recordScore(record, table) {
  const data = record.data || {}
  const classification = classifyPulseCampaignGoal(data, {
    integration_type: table?.integration_type,
    integration_settings: table?.integration_settings || {},
    category: table?.category,
  })
  let score = classification.goal === 'unknown' ? 0 : 10
  if (data.campaign_id) score += 2
  if (pulseCampaignOutcome(data, classification.goal).field) score += 3
  if (data.campaign_objective || data.optimization_goal) score += 2
  return score
}

function campaignIdentity(data, platform) {
  const id = data.campaign_id || data.campaignId
  const name = data.campaign_name || data.campaignName || data.campaign || data.name
  return {
    id: id ? String(id) : null,
    name: name ? String(name) : 'ללא שם',
    key: `${platform}:${id ? `id:${id}` : `name:${name || 'unknown'}`}`,
  }
}

function platformForIntegration(type) {
  if (type === 'google_ads') return 'google'
  if (type === 'facebook_insights' || type === 'facebook_ecommerce') return 'meta'
  return 'unknown'
}

function approvedTarget(settings = {}, data = {}, goal) {
  const campaignId = String(data.campaign_id || data.campaignId || '')
  const campaignName = String(data.campaign_name || data.campaignName || data.campaign || data.name || '')
  const targets = settings.pulse_targets || settings.campaign_targets || {}
  const mapped = targets[campaignId] || targets[campaignName] || targets.default || {}
  if (goal === 'ecommerce') {
    const roas = Number(mapped.roas ?? mapped.target_roas ?? settings.target_roas)
    if (Number.isFinite(roas) && roas > 0) return { value: roas, kind: 'roas', direction: 'minimum' }
    const cpa = Number(mapped.cpa ?? mapped.target_cpa ?? settings.target_cpa)
    if (Number.isFinite(cpa) && cpa > 0) return { value: cpa, kind: 'cpa', direction: 'maximum' }
  }
  if (goal === 'leads') {
    const cpl = Number(mapped.cpl ?? mapped.target_cpl ?? settings.target_cpl)
    if (Number.isFinite(cpl) && cpl > 0) return { value: cpl, kind: 'cpl', direction: 'maximum' }
  }
  if (goal === 'engagement') {
    const cost = Number(mapped.cost_per_result ?? mapped.target_cost_per_result ?? settings.target_cost_per_result)
    if (Number.isFinite(cost) && cost > 0) return { value: cost, kind: 'cost_per_result', direction: 'maximum' }
  }
  return null
}

function aggregate(rows, goal, outcomeKind) {
  let spend = 0
  let outcomes = 0
  let hasOutcomes = false
  let revenue = 0
  let impressions = 0
  let reach = 0
  let frequencyWeighted = 0
  let frequencyWeight = 0
  let freshest = null

  for (const row of rows) {
    const data = row.data || {}
    spend += numberValue(data, ['spend', 'cost'])
    impressions += numberValue(data, ['impressions'])
    reach += numberValue(data, ['reach'])
    revenue += numberValue(data, ['purchase_value', 'conversions_value', 'revenue'])
    const outcome = pulseCampaignOutcome(data, goal)
    if (outcome.value !== null && (!outcomeKind || outcome.kind === outcomeKind)) {
      outcomes += outcome.value
      hasOutcomes = true
    }
    const frequency = firstPresent(data, ['frequency']).value
    if (frequency !== null) {
      const weight = numberValue(data, ['reach']) || 1
      frequencyWeighted += frequency * weight
      frequencyWeight += weight
    }
    if (typeof data.date === 'string' && (!freshest || data.date > freshest)) freshest = data.date
  }

  return {
    spend,
    outcomes: hasOutcomes ? outcomes : null,
    revenue,
    impressions,
    reach,
    frequency: frequencyWeight ? frequencyWeighted / frequencyWeight : null,
    efficiency: hasOutcomes && outcomes > 0 ? spend / outcomes : null,
    roas: goal === 'ecommerce' && spend > 0 ? revenue / spend : null,
    freshest,
  }
}

function normalizedBaseline(rows, goal, outcomeKind, currentDates) {
  if (!rows.length) return aggregate([], goal, outcomeKind)
  const weekdays = new Set(currentDates.map((date) => utcDate(date).getUTCDay()))
  const matching = rows.filter((row) => weekdays.has(utcDate(row.data.date).getUTCDay()))
  const raw = aggregate(matching, goal, outcomeKind)
  const representedDays = new Set(matching.map((row) => row.data.date)).size
  const scale = representedDays > 0 ? currentDates.length / representedDays : 0
  return {
    ...raw,
    spend: raw.spend * scale,
    outcomes: raw.outcomes === null ? null : raw.outcomes * scale,
    revenue: raw.revenue * scale,
    impressions: raw.impressions * scale,
    reach: raw.reach * scale,
  }
}

function pct(current, baseline, lowerIsBetter) {
  if (current === null || baseline === null || baseline === 0) return null
  const raw = ((current - baseline) / Math.abs(baseline)) * 100
  return lowerIsBetter ? raw : -raw
}

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function classifyStatus({ goal, current3, current7, baseline3, baseline7, target, deliveryStatus = 'unknown' }) {
  if (deliveryStatus === 'paused') {
    return {
      status: 'healthy',
      tier: 'normal',
      reason: current7.spend > 0
        ? 'קמפיין מושהה — ההוצאה בחלון היא מלפני ההשהיה'
        : 'קמפיין מושהה — אין הוצאה פעילה',
      alertEligible: false,
    }
  }
  if (deliveryStatus === 'removed') {
    return {
      status: 'healthy',
      tier: 'normal',
      reason: 'קמפיין הוסר/לא פעיל',
      alertEligible: false,
    }
  }
  if (goal === 'unknown') {
    return {
      status: 'warning',
      tier: 'needs_classification',
      reason: 'מטרת הקמפיין אינה מזוהה — נדרש סיווג לפי יעד ואירוע אופטימיזציה',
      alertEligible: false,
    }
  }
  if (current7.outcomes === null) {
    return {
      status: 'warning',
      tier: 'missing_data',
      reason: 'נתון התוצאה חסר במקור ואינו מוצג כאפס',
      alertEligible: false,
    }
  }
  if (current7.spend > 0 && current7.outcomes === 0) {
    return {
      status: 'critical',
      tier: 'exception',
      reason: 'קיימת הוצאה ללא תוצאות ב־7 הימים המלאים האחרונים',
      alertEligible: true,
    }
  }

  const currentEfficiency = target?.kind === 'roas' ? current7.roas : current7.efficiency
  const current3Efficiency = target?.kind === 'roas' ? current3.roas : current3.efficiency
  if (target && currentEfficiency !== null) {
    const bad7 = target.direction === 'minimum'
      ? currentEfficiency < target.value
      : currentEfficiency > target.value
    const bad3 = current3Efficiency !== null && (
      target.direction === 'minimum'
        ? current3Efficiency < target.value
        : current3Efficiency > target.value
    )
    if (bad7 && bad3) {
      return {
        status: 'critical',
        tier: 'exception',
        reason: `חריגה מתמשכת מהיעד המאושר (${target.kind.toUpperCase()} ${target.value})`,
        alertEligible: true,
      }
    }
    if (bad7) {
      return {
        status: 'warning',
        tier: 'watch',
        reason: `חריגה מהיעד המאושר ב־7 ימים; נדרשת התמדה לפני התראה`,
        alertEligible: false,
      }
    }
    return {
      status: 'healthy',
      tier: 'normal',
      reason: 'התוצאה בתוך היעד המאושר',
      alertEligible: false,
    }
  }

  const useRoas = goal === 'ecommerce' && target?.kind !== 'cpa'
  const lowerIsBetter = !useRoas
  const trend3 = pct(
    useRoas ? current3.roas : current3.efficiency,
    useRoas ? baseline3.roas : baseline3.efficiency,
    lowerIsBetter,
  )
  const trend7 = pct(
    useRoas ? current7.roas : current7.efficiency,
    useRoas ? baseline7.roas : baseline7.efficiency,
    lowerIsBetter,
  )
  const worsening = trend3 !== null && trend7 !== null && trend3 >= 25 && trend7 >= 25
  return worsening
    ? {
        status: 'warning',
        tier: 'watch',
        reason: 'מגמה מתמשכת למעקב; אין יעד מאושר ולכן לא נשלחת התראת כשל',
        alertEligible: false,
      }
    : {
        status: 'healthy',
        tier: 'normal',
        reason: target ? 'בתוך היעד המאושר' : 'לא זוהתה חריגה; אין יעד מאושר להשוואה',
        alertEligible: false,
      }
}

function datesBetween(start, end) {
  const dates = []
  for (let date = utcDate(start); date <= utcDate(end); date = addDays(date, 1)) dates.push(ymd(date))
  return dates
}

export function buildPulseCampaignRows({
  records = [],
  tables = [],
  nowYmd,
}) {
  const windows = pulseTrendWindows(nowYmd)
  const tableMap = new Map(tables.map((table) => [table.id, table]))
  const deduped = new Map()

  for (const record of records) {
    const data = record.data || {}
    if (String(data.entity_level || 'campaign').toLowerCase() !== 'campaign') continue
    if (typeof data.date !== 'string' || data.date < windows.queryStart || data.date > windows.queryEnd) continue
    const table = tableMap.get(record.table_id)
    if (!table) continue
    const platform = platformForIntegration(table.integration_type)
    if (platform === 'unknown') continue
    const identity = campaignIdentity(data, platform)
    const key = `${identity.key}:${data.date}`
    const previous = deduped.get(key)
    if (!previous || recordScore(record, table) > recordScore(previous.record, previous.table)) {
      deduped.set(key, { record, table, identity, platform })
    }
  }

  const campaigns = new Map()
  for (const item of deduped.values()) {
    const key = item.identity.key
    const list = campaigns.get(key) || []
    list.push(item)
    campaigns.set(key, list)
  }

  const current3Dates = datesBetween(windows.current3.start, windows.current3.end)
  const current7Dates = datesBetween(windows.current7.start, windows.current7.end)
  const rows = []

  for (const items of campaigns.values()) {
    const sample = items.reduce((best, item) =>
      !best || recordScore(item.record, item.table) > recordScore(best.record, best.table) ? item : best)
    const classification = classifyPulseCampaignGoal(sample.record.data, {
      integration_type: sample.table.integration_type,
      integration_settings: sample.table.integration_settings || {},
      category: sample.table.category,
    })
    const outcome = pulseCampaignOutcome(sample.record.data, classification.goal)
    const campaignRecords = items.map((item) => item.record)
    const inWindow = (start, end) => campaignRecords.filter((row) => row.data.date >= start && row.data.date <= end)
    const current3 = aggregate(inWindow(windows.current3.start, windows.current3.end), classification.goal, outcome.kind)
    const current7 = aggregate(inWindow(windows.current7.start, windows.current7.end), classification.goal, outcome.kind)
    const today = aggregate(inWindow(windows.today, windows.today), classification.goal, outcome.kind)
    const baselineRows = inWindow(windows.baseline.start, windows.baseline.end)
    const baseline3 = normalizedBaseline(baselineRows, classification.goal, outcome.kind, current3Dates)
    const baseline7 = normalizedBaseline(baselineRows, classification.goal, outcome.kind, current7Dates)
    const tableSettings = sample.table.integration_settings || {}
    const deliveryStatus = resolveCampaignDeliveryStatus(sample.record.data, tableSettings)
    const target = approvedTarget(tableSettings, sample.record.data, classification.goal)
    const status = classifyStatus({
      goal: classification.goal,
      current3,
      current7,
      baseline3,
      baseline7,
      target,
      deliveryStatus,
    })
    const useRoas = classification.goal === 'ecommerce' && target?.kind !== 'cpa'
    const lowerIsBetter = !useRoas
    const efficiency3 = useRoas ? current3.roas : current3.efficiency
    const efficiency7 = useRoas ? current7.roas : current7.efficiency
    const efficiencyToday = useRoas ? today.roas : today.efficiency
    const baselineEfficiency3 = useRoas ? baseline3.roas : baseline3.efficiency
    const baselineEfficiency7 = useRoas ? baseline7.roas : baseline7.efficiency
    const settings = tableSettings
    const lastChangeCandidates = [
      ...items.map((item) => item.record.data.updated_time),
      settings.last_campaign_updated_at,
      settings.last_meta_activity?.at,
    ].filter(Boolean).map(String).sort()

    rows.push({
      campaign_key: sample.identity.key,
      campaign_id: sample.identity.id,
      campaign_name: sample.identity.name,
      client_id: sample.table.client_id,
      table_id: sample.table.id,
      platform: sample.platform,
      goal: classification.goal,
      campaign_objective: sample.record.data.campaign_objective || sample.record.data.objective || null,
      optimization_goal: sample.record.data.optimization_goal || null,
      campaign_type_hint: sample.record.data.campaign_type || null,
      result_kind: sample.record.data.result_kind || null,
      delivery_status: deliveryStatus,
      classification_source: classification.source,
      outcome_kind: outcome.kind,
      status: status.status,
      status_tier: status.tier,
      status_reason: status.reason,
      alert_eligible: status.alertEligible,
      target_value: target?.value ?? null,
      target_kind: target?.kind ?? null,
      spend_3d: round(current3.spend),
      outcomes_3d: round(current3.outcomes),
      efficiency_3d: round(efficiency3),
      spend_7d: round(current7.spend),
      outcomes_7d: round(current7.outcomes),
      revenue_7d: round(current7.revenue),
      efficiency_7d: round(efficiency7),
      baseline_efficiency_3d: round(baselineEfficiency3),
      baseline_efficiency_7d: round(baselineEfficiency7),
      trend_3d_pct: round(pct(efficiency3, baselineEfficiency3, lowerIsBetter), 1),
      trend_7d_pct: round(pct(efficiency7, baselineEfficiency7, lowerIsBetter), 1),
      impressions_7d: round(current7.impressions),
      reach_7d: round(current7.reach),
      frequency_7d: round(current7.frequency),
      spend_today: round(today.spend),
      outcomes_today: round(today.outcomes),
      revenue_today: round(today.revenue),
      efficiency_today: round(efficiencyToday),
      data_fresh_through: today.freshest || current7.freshest,
      last_change_at: lastChangeCandidates.at(-1) || null,
      last_sync_at: settings.last_sync_at || null,
      partial_today_excluded: true,
      today_partial_included: Boolean(today.freshest),
    })
  }

  return rows.sort((a, b) =>
    String(a.client_id).localeCompare(String(b.client_id))
    || String(a.campaign_name).localeCompare(String(b.campaign_name), 'he')
  )
}
