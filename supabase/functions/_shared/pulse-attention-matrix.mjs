const MOOD_STATUS_LABELS = {
  happy: '😊 מבסוט / תקין',
  wavering: '😐 מתנדנד / רגיש',
  churn_risk: '😟 סכנת נטישה / תלונה',
  not_progressing: '😔 לא מתקדם',
  normal: '😊 מבסוט / תקין',
  sensitive: '😐 מתנדנד / רגיש',
  complaint: '😟 סכנת נטישה / תלונה',
}

const TREND_WATCH_PCT = 25
const MS_PER_DAY = 86_400_000

function daysSince(iso) {
  if (!iso) return null
  const parsed = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.floor((Date.now() - parsed.getTime()) / MS_PER_DAY)
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function goalFromRows(rows) {
  const counts = new Map()
  for (const row of rows) {
    if (row.goal === 'unknown') continue
    counts.set(row.goal, (counts.get(row.goal) ?? 0) + (row.spend_7d ?? 0))
  }
  let best = 'leads'
  let bestSpend = -1
  for (const [goal, spend] of counts) {
    if (spend > bestSpend) {
      best = goal
      bestSpend = spend
    }
  }
  if (bestSpend >= 0) return best
  return rows.find((row) => row.goal !== 'unknown')?.goal ?? 'leads'
}

function rowsForGoal(rows, goal) {
  return rows.filter((row) => row.goal === goal)
}

function aggregatePlatformMetrics(rows) {
  const primaryGoal = goalFromRows(rows)
  const goalRows = rowsForGoal(rows, primaryGoal)
  const scopedRows = goalRows.length ? goalRows : rows

  let spend7d = 0
  let outcomes7d = 0
  let hasOutcomes = false
  let revenue7d = 0
  let trendWeighted = 0
  let trendWeight = 0
  let baselineWeighted = 0
  let baselineWeight = 0
  let lastChangeAt = null

  for (const row of scopedRows) {
    spend7d += row.spend_7d ?? 0
    if (row.outcomes_7d !== null && row.outcomes_7d !== undefined) {
      outcomes7d += row.outcomes_7d
      hasOutcomes = true
    }
    revenue7d += row.revenue_7d ?? 0
    if (row.trend_7d_pct !== null && row.spend_7d > 0) {
      trendWeighted += row.trend_7d_pct * row.spend_7d
      trendWeight += row.spend_7d
    }
    const baseline = row.baseline_efficiency_7d
    if (baseline !== null && baseline !== undefined && row.spend_7d > 0) {
      baselineWeighted += baseline * row.spend_7d
      baselineWeight += row.spend_7d
    }
    if (row.last_change_at && (!lastChangeAt || row.last_change_at > lastChangeAt)) {
      lastChangeAt = row.last_change_at
    }
  }

  const useRoas = primaryGoal === 'ecommerce'
  const efficiency7d = useRoas
    ? spend7d > 0 ? revenue7d / spend7d : null
    : hasOutcomes && outcomes7d > 0 ? spend7d / outcomes7d : null

  return {
    primaryGoal,
    spend7d,
    efficiency7d: efficiency7d === null ? null : round(efficiency7d),
    trend7dPct: trendWeight > 0 ? round(trendWeighted / trendWeight, 1) : null,
    baselineEfficiency7d: baselineWeight > 0 ? round(baselineWeighted / baselineWeight) : null,
    lastChangeAt,
  }
}

export function readApprovedPlatformTarget(settings = {}, goal) {
  const platformTargets = settings.pulse_platform_targets || {}
  const goalTargets = platformTargets[goal] || platformTargets.default || {}
  const legacyTargets = settings.pulse_targets || settings.campaign_targets || {}
  const mapped = { ...(legacyTargets.default || {}), ...goalTargets }

  if (goal === 'ecommerce') {
    const roas = Number(mapped.roas ?? mapped.target_roas ?? settings.target_roas)
    if (Number.isFinite(roas) && roas > 0) return { value: roas, kind: 'roas', direction: 'minimum', source: 'approved' }
    const cpa = Number(mapped.cpa ?? mapped.target_cpa ?? settings.target_cpa)
    if (Number.isFinite(cpa) && cpa > 0) return { value: cpa, kind: 'cpa', direction: 'maximum', source: 'approved' }
  }
  if (goal === 'leads') {
    const cpl = Number(mapped.cpl ?? mapped.target_cpl ?? settings.target_cpl)
    if (Number.isFinite(cpl) && cpl > 0) return { value: cpl, kind: 'cpl', direction: 'maximum', source: 'approved' }
  }
  if (goal === 'engagement') {
    const cost = Number(mapped.cost_per_result ?? mapped.target_cost_per_result ?? settings.target_cost_per_result)
    if (Number.isFinite(cost) && cost > 0) return { value: cost, kind: 'cost_per_result', direction: 'maximum', source: 'approved' }
  }
  return null
}

export function resolvePlatformTarget(settings, goal, baselineEfficiency7d) {
  const approved = readApprovedPlatformTarget(settings || {}, goal)
  if (approved) return approved
  if (baselineEfficiency7d !== null && baselineEfficiency7d !== undefined && Number.isFinite(baselineEfficiency7d) && baselineEfficiency7d > 0) {
    const useRoas = goal === 'ecommerce'
    return {
      value: round(baselineEfficiency7d),
      kind: useRoas ? 'roas' : goal === 'leads' ? 'cpl' : 'cost_per_result',
      direction: useRoas ? 'minimum' : 'maximum',
      source: 'baseline_30d',
    }
  }
  return null
}

function isEfficiencyWorse(current, target) {
  if (target.direction === 'minimum') return current < target.value
  return current > target.value
}

export function evaluateEfficiencyIssue({ currentEfficiency, trend7dPct, target }) {
  if (currentEfficiency === null) return null

  if (target?.source === 'approved') {
    if (isEfficiencyWorse(currentEfficiency, target)) {
      const kindLabel = target.kind === 'roas' ? 'ROAS' : target.kind === 'cpl' ? 'CPL' : target.kind === 'cpa' ? 'CPA' : 'עלות לתוצאה'
      return { level: 'alert', label: `${kindLabel} ${currentEfficiency} מול יעד ${target.value}` }
    }
    return null
  }

  if (trend7dPct !== null && trend7dPct >= TREND_WATCH_PCT) {
    return { level: trend7dPct >= 40 ? 'alert' : 'watch', label: `מגמת 7 ימים +${trend7dPct}% (ללא יעד מאושר)` }
  }

  if (target?.source === 'baseline_30d' && isEfficiencyWorse(currentEfficiency, target)) {
    const pctAbove = target.direction === 'maximum'
      ? round(((currentEfficiency - target.value) / target.value) * 100, 1)
      : round(((target.value - currentEfficiency) / target.value) * 100, 1)
    return { level: pctAbove >= 25 ? 'alert' : 'watch', label: `מול בסיס 30 יום (${target.value}) — ${pctAbove}%` }
  }

  return null
}

function evaluateCampaignTouchIssue(lastChangeAt, spend7d, hasEfficiencyIssue) {
  if (spend7d <= 0) return null
  const days = daysSince(lastChangeAt)
  if (days === null) return hasEfficiencyIssue ? { level: 'watch', label: 'אין תיעוד מגע בקמפיין' } : null
  if (days >= 7) return { level: 'alert', label: `${days} ימים ללא מגע בקמפיין` }
  if (days >= 3 && hasEfficiencyIssue) return { level: 'watch', label: `${days} ימים ללא מגע + ירידה בביצועים` }
  return null
}

function evaluateLastCommunicationIssue(daysSinceLastCommunication, lastClientCallAt) {
  const days = daysSinceLastCommunication ?? daysSince(lastClientCallAt)
  if (days === null) return { level: 'watch', label: 'אין תיעוד שיחה עם הלקוח' }
  if (days >= 45) return { level: 'alert', label: `${days} ימים ללא תקשורת` }
  if (days >= 30) return { level: 'watch', label: `${days} ימים ללא תקשורת` }
  return null
}

function evaluateComplaintIssue({ recentCommunicationStatus, hasRecentComplaintUpdate }) {
  if (recentCommunicationStatus === 'complaint' || hasRecentComplaintUpdate) return { level: 'alert', label: 'תלונה / עדכון רגיש' }
  if (recentCommunicationStatus === 'sensitive') return { level: 'watch', label: 'עדכון רגיש' }
  return null
}

function evaluateSatisfactionIssue(moodStatus) {
  if (!moodStatus || moodStatus === 'happy' || moodStatus === 'normal') return null
  const label = MOOD_STATUS_LABELS[moodStatus] ?? moodStatus
  if (moodStatus === 'churn_risk' || moodStatus === 'complaint') return { level: 'alert', label }
  return { level: 'watch', label }
}

function pickPrimaryTable(tables, platform, goal) {
  const matches = tables.filter((table) => {
    if (platform === 'google') return table.integration_type === 'google_ads'
    return table.integration_type === 'facebook_insights' || table.integration_type === 'facebook_ecommerce'
  })
  if (!matches.length) return null
  if (platform === 'google') return matches[0]
  if (goal === 'ecommerce') {
    return matches.find((table) => table.integration_type === 'facebook_ecommerce') ?? matches[0]
  }
  return matches.find((table) => table.integration_type === 'facebook_insights') ?? matches[0]
}

function rowHasIssue(issues) {
  return Object.values(issues).some((issue) => issue && issue.level !== 'ok')
}

export function buildPulseAttentionRows({ campaignRows = [], tables = [], clients = [] }) {
  const clientMap = new Map(clients.map((client) => [client.clientId, client]))
  const tablesByClient = new Map()
  for (const table of tables) {
    const list = tablesByClient.get(table.client_id) ?? []
    list.push(table)
    tablesByClient.set(table.client_id, list)
  }

  const grouped = new Map()
  for (const row of campaignRows) {
    if (row.platform !== 'meta' && row.platform !== 'google') continue
    const key = `${row.client_id}:${row.platform}`
    const list = grouped.get(key) ?? []
    list.push(row)
    grouped.set(key, list)
  }

  const result = []
  for (const [key, rows] of grouped) {
    const [clientId, platform] = key.split(':')
    const client = clientMap.get(clientId)
    if (!client) continue

    const metrics = aggregatePlatformMetrics(rows)
    if (metrics.spend7d <= 0) continue

    const primaryTable = pickPrimaryTable(tablesByClient.get(clientId) ?? [], platform, metrics.primaryGoal)
    const settings = primaryTable?.integration_settings || {}
    const target = resolvePlatformTarget(settings, metrics.primaryGoal, metrics.baselineEfficiency7d)
    const efficiencyIssue = evaluateEfficiencyIssue({
      currentEfficiency: metrics.efficiency7d,
      trend7dPct: metrics.trend7dPct,
      target,
    })

    const issues = {
      campaignTouch: evaluateCampaignTouchIssue(metrics.lastChangeAt, metrics.spend7d, Boolean(efficiencyIssue)),
      efficiency: efficiencyIssue,
      lastCommunication: evaluateLastCommunicationIssue(client.daysSinceLastCommunication, client.lastClientCallAt),
      complaintUpdate: evaluateComplaintIssue({
        recentCommunicationStatus: client.recentCommunicationStatus,
        hasRecentComplaintUpdate: client.hasRecentComplaintUpdate,
      }),
      satisfaction: evaluateSatisfactionIssue(client.moodStatus),
    }

    if (!rowHasIssue(issues)) continue

    result.push({
      clientId,
      clientName: client.clientName,
      campaignerName: client.campaignerName,
      platform,
      tableId: primaryTable?.id ?? null,
      primaryGoal: metrics.primaryGoal,
      target,
      currentEfficiency: metrics.efficiency7d,
      spend7d: metrics.spend7d,
      issues,
      hasAnyIssue: true,
    })
  }

  return result.sort((a, b) => String(a.clientName).localeCompare(String(b.clientName), 'he') || String(a.platform).localeCompare(String(b.platform)))
}

export function platformTargetFieldKey(goal) {
  if (goal === 'ecommerce') return 'roas'
  if (goal === 'engagement') return 'cost_per_result'
  return 'cpl'
}

export function buildPlatformTargetPatch(existingSettings = {}, goal, value) {
  const currentPlatformTargets = { ...(existingSettings.pulse_platform_targets || {}) }
  const field = platformTargetFieldKey(goal)
  if (value === null || !Number.isFinite(value) || value <= 0) {
    const nextGoal = { ...(currentPlatformTargets[goal] || {}) }
    delete nextGoal[field]
    delete nextGoal[`target_${field}`]
    if (Object.keys(nextGoal).length === 0) delete currentPlatformTargets[goal]
    else currentPlatformTargets[goal] = nextGoal
  } else {
    currentPlatformTargets[goal] = { ...(currentPlatformTargets[goal] || {}), [field]: value }
  }
  return { ...existingSettings, pulse_platform_targets: currentPlatformTargets }
}
