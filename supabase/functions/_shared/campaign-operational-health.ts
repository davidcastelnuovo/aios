export type OperationalCampaignState = {
  id: string
  name: string
  status: string
  primary_status?: string | null
  primary_status_reasons?: string[]
}

export type OperationalIssue = {
  campaign_id: string
  campaign_name: string
  alert_type: 'campaign_stopped'
  severity: 'critical'
  details: Record<string, unknown>
}

const SERVING_STATUSES = new Set(['ELIGIBLE', 'LIMITED', 'ACTIVE'])

export function evaluateGoogleOperationalIssues(
  previous: Record<string, OperationalCampaignState> | null | undefined,
  current: OperationalCampaignState[],
): OperationalIssue[] {
  if (!previous || Object.keys(previous).length === 0) return []

  return current.flatMap((campaign) => {
    const before = previous[campaign.id]
    if (!before) return []
    const wasEnabled = before.status === 'ENABLED'
    const isEnabled = campaign.status === 'ENABLED'
    const isServing = !campaign.primary_status || SERVING_STATUSES.has(campaign.primary_status)
    if (!wasEnabled || (isEnabled && isServing)) return []

    return [{
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      alert_type: 'campaign_stopped' as const,
      severity: 'critical' as const,
      details: {
        provider: 'google_ads',
        previous_status: before.status,
        status: campaign.status,
        primary_status: campaign.primary_status || null,
        primary_status_reasons: campaign.primary_status_reasons || [],
      },
    }]
  })
}

export function campaignStateMap(campaigns: OperationalCampaignState[]) {
  return Object.fromEntries(campaigns.map((campaign) => [campaign.id, campaign]))
}
