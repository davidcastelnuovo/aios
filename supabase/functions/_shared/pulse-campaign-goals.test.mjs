import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPulseCampaignRows,
  classifyPulseCampaignGoal,
  pulseCampaignOutcome,
  pulseTrendWindows,
} from './pulse-campaign-goals.mjs'

test('classifies campaign objective and never defaults an unknown campaign to leads', () => {
  assert.equal(classifyPulseCampaignGoal({ campaign_objective: 'OUTCOME_LEADS' }).goal, 'leads')
  assert.equal(classifyPulseCampaignGoal({ campaign_type: 'traffic' }).goal, 'engagement')
  assert.equal(classifyPulseCampaignGoal({ optimization_goal: 'THRUPLAY' }).goal, 'engagement')
  assert.equal(classifyPulseCampaignGoal({ campaign_objective: 'OUTCOME_SALES' }).goal, 'ecommerce')
  assert.equal(classifyPulseCampaignGoal({ campaign_name: 'קמפיין קיץ' }).goal, 'unknown')
})

test('keeps a missing outcome missing instead of converting it to zero', () => {
  assert.equal(pulseCampaignOutcome({ spend: 100 }, 'engagement').value, null)
  assert.equal(pulseCampaignOutcome({ clicks: 0 }, 'engagement').value, 0)
})

test('uses complete days and a non-overlapping 28-day baseline', () => {
  assert.deepEqual(pulseTrendWindows('2026-09-18'), {
    current3: { start: '2026-09-15', end: '2026-09-17' },
    current7: { start: '2026-09-11', end: '2026-09-17' },
    baseline: { start: '2026-08-14', end: '2026-09-10' },
    queryStart: '2026-08-14',
    queryEnd: '2026-09-17',
  })
})

test('splits a mixed client into three categories without double counting duplicate Meta tables', () => {
  const tables = [
    { id: 'meta-main', client_id: 'c1', integration_type: 'facebook_insights', integration_settings: {} },
    { id: 'meta-copy', client_id: 'c1', integration_type: 'facebook_ecommerce', integration_settings: {} },
  ]
  const dates = ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']
  const records = []
  for (const date of dates) {
    records.push(
      { table_id: 'meta-main', data: { date, campaign_id: 'lead', campaign_name: 'Lead', campaign_type: 'lead', spend: 10, leads: 1 } },
      { table_id: 'meta-main', data: { date, campaign_id: 'eng', campaign_name: 'Video', campaign_type: 'traffic', spend: 20, video_views: 10 } },
      { table_id: 'meta-main', data: { date, campaign_id: 'sale', campaign_name: 'Sale', campaign_type: 'ecommerce', spend: 30, purchases: 2, purchase_value: 120 } },
      // Duplicate daily campaign from a second synced Meta table: must not be counted twice.
      { table_id: 'meta-copy', data: { date, campaign_id: 'sale', campaign_name: 'Sale', campaign_type: 'ecommerce', spend: 30, purchases: 2, purchase_value: 120 } },
    )
  }
  const rows = buildPulseCampaignRows({ records, tables, nowYmd: '2026-09-18' })
  assert.deepEqual(rows.map((row) => row.goal).sort(), ['ecommerce', 'engagement', 'leads'])
  assert.equal(rows.reduce((total, row) => total + row.spend_7d, 0), 420)
})

test('CPL increase inside an approved target stays healthy and is not alert eligible', () => {
  const tables = [{
    id: 't1',
    client_id: 'c1',
    integration_type: 'facebook_insights',
    integration_settings: { target_cpl: 50 },
  }]
  const records = []
  for (let day = 14; day <= 17; day += 1) {
    records.push({
      table_id: 't1',
      data: {
        date: `2026-09-${day}`,
        campaign_id: 'lead',
        campaign_type: 'lead',
        spend: 40,
        leads: 1,
      },
    })
  }
  const row = buildPulseCampaignRows({ records, tables, nowYmd: '2026-09-18' })[0]
  assert.equal(row.efficiency_7d, 40)
  assert.equal(row.status, 'healthy')
  assert.equal(row.alert_eligible, false)
  assert.match(row.status_reason, /בתוך היעד/)
})

test('persistent target breach becomes an evidence-backed exception', () => {
  const tables = [{
    id: 't1',
    client_id: 'c1',
    integration_type: 'facebook_insights',
    integration_settings: { target_cpl: 30 },
  }]
  const records = []
  for (let day = 11; day <= 17; day += 1) {
    records.push({
      table_id: 't1',
      data: {
        date: `2026-09-${day}`,
        campaign_id: 'lead',
        campaign_name: 'Leads',
        campaign_type: 'lead',
        spend: 50,
        leads: 1,
      },
    })
  }
  const row = buildPulseCampaignRows({ records, tables, nowYmd: '2026-09-18' })[0]
  assert.equal(row.status, 'critical')
  assert.equal(row.alert_eligible, true)
  assert.equal(row.target_value, 30)
})
