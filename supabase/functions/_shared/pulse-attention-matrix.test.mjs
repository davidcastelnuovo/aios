import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPulseAttentionRows,
  evaluateEfficiencyIssue,
  readApprovedPlatformTarget,
  resolvePlatformTarget,
} from './pulse-attention-matrix.mjs'

test('readApprovedPlatformTarget reads pulse_platform_targets', () => {
  assert.equal(
    readApprovedPlatformTarget({ pulse_platform_targets: { leads: { cpl: 90 } } }, 'leads')?.value,
    90,
  )
})

test('resolvePlatformTarget falls back to 30d baseline', () => {
  assert.equal(resolvePlatformTarget({}, 'leads', 75)?.source, 'baseline_30d')
})

test('evaluateEfficiencyIssue flags approved target breach', () => {
  const issue = evaluateEfficiencyIssue({
    currentEfficiency: 120,
    trend7dPct: null,
    target: { value: 90, kind: 'cpl', direction: 'maximum', source: 'approved' },
  })
  assert.equal(issue?.level, 'alert')
})

test('buildPulseAttentionRows includes only rows with issues', () => {
  const rows = buildPulseAttentionRows({
    campaignRows: [{
      campaign_key: 'meta:id:1',
      client_id: 'client-1',
      platform: 'meta',
      goal: 'leads',
      spend_7d: 1000,
      outcomes_7d: 10,
      revenue_7d: 0,
      efficiency_7d: 100,
      baseline_efficiency_7d: 80,
      trend_7d_pct: 30,
      last_change_at: '2026-09-10T10:00:00Z',
    }],
    tables: [{
      id: 'table-1',
      client_id: 'client-1',
      integration_type: 'facebook_insights',
      integration_settings: {},
    }],
    clients: [{
      clientId: 'client-1',
      clientName: 'לקוח א',
      campaignerName: 'דוד',
      moodStatus: 'happy',
      lastClientCallAt: '2026-08-01T10:00:00Z',
      daysSinceLastCommunication: 35,
      recentCommunicationStatus: null,
      hasRecentComplaintUpdate: false,
    }],
  })
  assert.ok(rows.length >= 1)
  assert.ok(rows.some((row) => row.issues.efficiency || row.issues.lastCommunication))
})
