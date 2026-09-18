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
  assert.equal(classifyPulseCampaignGoal({ campaign_objective: 'OUTCOME_TRAFFIC' }).goal, 'engagement')
  assert.equal(classifyPulseCampaignGoal({ campaign_type: 'traffic' }).goal, 'engagement')
  assert.equal(classifyPulseCampaignGoal({ optimization_goal: 'THRUPLAY' }).goal, 'engagement')
  assert.equal(classifyPulseCampaignGoal({ campaign_objective: 'OUTCOME_SALES' }).goal, 'ecommerce')
  assert.equal(classifyPulseCampaignGoal({ campaign_name: 'קמפיין קיץ' }).goal, 'unknown')
  assert.equal(
    classifyPulseCampaignGoal({
      campaign_objective: 'OUTCOME_SALES',
      campaign_type: 'lead',
    }).goal,
    'ecommerce',
  )
  assert.equal(
    classifyPulseCampaignGoal({}, { integration_type: 'facebook_ecommerce' }).goal,
    'ecommerce',
  )
  assert.equal(
    classifyPulseCampaignGoal(
      { campaign_type: 'lead' },
      { integration_type: 'facebook_insights', category: 'איקומרס' },
    ).goal,
    'ecommerce',
  )
  assert.equal(
    classifyPulseCampaignGoal(
      { campaign_type: 'lead' },
      { integration_type: 'facebook_ecommerce' },
    ).goal,
    'ecommerce',
  )
  assert.equal(
    classifyPulseCampaignGoal(
      { campaign_type: 'lead', campaign_objective: 'OUTCOME_LEADS' },
      { integration_type: 'facebook_ecommerce' },
    ).goal,
    'leads',
  )
  assert.equal(
    classifyPulseCampaignGoal(
      { campaign_objective: 'OUTCOME_SALES' },
      { integration_settings: { campaign_type: 'leads' } },
    ).goal,
    'ecommerce',
  )
})

test('classifies from synced result_kind and Hebrew campaign names', () => {
  assert.equal(
    classifyPulseCampaignGoal({ result_kind: 'purchases' }).goal,
    'ecommerce',
  )
  assert.equal(
    classifyPulseCampaignGoal({ result_kind: 'video_views' }).goal,
    'engagement',
  )
  assert.equal(
    classifyPulseCampaignGoal({ campaign_name: 'קמפיין מכירות | מבצעים ספטמבר' }).goal,
    'ecommerce',
  )
  assert.equal(
    classifyPulseCampaignGoal({ campaign_name: 'קמפיין מעורבות | סרטונים חדש' }).goal,
    'engagement',
  )
  assert.equal(
    classifyPulseCampaignGoal({ campaign_name: 'קמפיין לידים | דרושים' }).goal,
    'leads',
  )
})

test('Avieli Tayg-style mixed Meta account splits into leads, engagement, and ecommerce', () => {
  const tables = [{
    id: 't-meta',
    client_id: 'avieli',
    integration_type: 'facebook_ecommerce',
    integration_settings: {},
  }]
  const dates = ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']
  const specs = [
    {
      campaign_id: 'eng',
      campaign_name: 'קמפיין מעורבות | סרטונים חדש',
      campaign_objective: 'OUTCOME_ENGAGEMENT',
      optimization_goal: 'THRUPLAY',
      spend: 10,
      video_views: 20,
    },
    {
      campaign_id: 'sale',
      campaign_name: 'קמפיין מכירות | מבצעים ספטמבר',
      campaign_objective: 'OUTCOME_SALES',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      spend: 50,
      purchases: 1,
      purchase_value: 100,
    },
    {
      campaign_id: 'wa',
      campaign_name: 'קמפיין ווטסאפ | ברזל',
      campaign_objective: 'OUTCOME_ENGAGEMENT',
      optimization_goal: 'CONVERSATIONS',
      spend: 30,
      conversations: 4,
    },
    {
      campaign_id: 'lead',
      campaign_name: 'קמפיין לידים | דרושים',
      campaign_objective: 'OUTCOME_LEADS',
      optimization_goal: 'LEAD_GENERATION',
      spend: 5,
      leads: 1,
    },
    {
      campaign_id: 'off',
      campaign_name: 'קמפיין מכירות | מבצעים אוגוסט 2',
      campaign_objective: 'OUTCOME_SALES',
      effective_status: 'PAUSED',
      spend: 0,
    },
  ]
  const records = []
  for (const date of dates) {
    for (const spec of specs) {
      records.push({
        table_id: 't-meta',
        data: { date, entity_level: 'campaign', ...spec },
      })
    }
  }
  const rows = buildPulseCampaignRows({ records, tables, nowYmd: '2026-09-18' })
  assert.deepEqual(rows.map((row) => row.goal).sort(), ['ecommerce', 'ecommerce', 'engagement', 'engagement', 'leads'])
  const spending = rows.filter((row) => row.spend_7d > 0)
  assert.equal(spending.length, 4)
  assert.equal(spending.find((row) => row.campaign_id === 'off'), undefined)
})

test('ecommerce report tables classify purchase campaigns and rebuild mixed clients', () => {
  const tables = [{
    id: 't-ecom',
    client_id: 'abihail',
    integration_type: 'facebook_ecommerce',
    integration_settings: {},
  }]
  const dates = ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']
  const records = []
  for (const date of dates) {
    records.push(
      {
        table_id: 't-ecom',
        data: {
          date,
          campaign_id: 'sale',
          campaign_name: 'Purchase',
          campaign_objective: 'OUTCOME_SALES',
          campaign_type: 'ecommerce',
          spend: 40,
          purchases: 2,
          purchase_value: 200,
        },
      },
      {
        table_id: 't-ecom',
        data: {
          date,
          campaign_id: 'video',
          campaign_name: 'Views',
          campaign_objective: 'OUTCOME_ENGAGEMENT',
          optimization_goal: 'THRUPLAY',
          campaign_type: 'traffic',
          spend: 20,
          video_views: 50,
        },
      },
      {
        table_id: 't-ecom',
        data: {
          date,
          campaign_id: 'lead',
          campaign_name: 'Lead form',
          campaign_objective: 'OUTCOME_LEADS',
          campaign_type: 'lead',
          spend: 10,
          leads: 1,
        },
      },
    )
  }
  const rows = buildPulseCampaignRows({ records, tables, nowYmd: '2026-09-18' })
  assert.deepEqual(rows.map((row) => row.goal).sort(), ['ecommerce', 'engagement', 'leads'])
  const purchase = rows.find((row) => row.campaign_id === 'sale')
  assert.equal(purchase.outcome_kind, 'purchases')
  assert.equal(purchase.outcomes_7d, 14)
})

test('keeps a missing outcome missing instead of converting it to zero', () => {
  assert.equal(pulseCampaignOutcome({ spend: 100 }, 'engagement').value, null)
  assert.equal(pulseCampaignOutcome({ clicks: 0 }, 'engagement').value, 0)
})

test('uses complete days for trends and still fetches today as a partial window', () => {
  assert.deepEqual(pulseTrendWindows('2026-09-18'), {
    current3: { start: '2026-09-15', end: '2026-09-17' },
    current7: { start: '2026-09-11', end: '2026-09-17' },
    baseline: { start: '2026-08-14', end: '2026-09-10' },
    today: '2026-09-18',
    queryStart: '2026-08-14',
    queryEnd: '2026-09-18',
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

test('paused campaigns with spend but no leads are not critical', () => {
  const tables = [{
    id: 't1',
    client_id: 'c1',
    integration_type: 'facebook_insights',
    integration_settings: {},
  }]
  const records = []
  for (let day = 11; day <= 17; day += 1) {
    records.push({
      table_id: 't1',
      data: {
        date: `2026-09-${day}`,
        campaign_id: 'bad',
        campaign_name: 'Old test',
        campaign_type: 'lead',
        effective_status: 'PAUSED',
        spend: 80,
        leads: 0,
      },
    })
  }
  const row = buildPulseCampaignRows({ records, tables, nowYmd: '2026-09-18' })[0]
  assert.equal(row.delivery_status, 'paused')
  assert.equal(row.status, 'healthy')
  assert.match(row.status_reason, /מושהה/)
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

test('afternoon partial today is shown separately and does not inflate the 7-day window', () => {
  const tables = [{
    id: 't1',
    client_id: 'c1',
    integration_type: 'facebook_insights',
    integration_settings: {
      last_sync_at: '2026-09-18T11:00:00.000Z',
      last_campaign_updated_at: '2026-09-18T10:30:00.000Z',
      last_meta_activity: { at: '2026-09-18T10:45:00.000Z', type: 'updated ad', actor: 'דנה', object: 'Lead' },
    },
  }]
  const records = [
    { table_id: 't1', data: { date: '2026-09-17', campaign_id: 'lead', campaign_type: 'lead', spend: 70, leads: 1, updated_time: '2026-09-17T08:00:00.000Z' } },
    { table_id: 't1', data: { date: '2026-09-18', campaign_id: 'lead', campaign_type: 'lead', spend: 999, leads: 9, updated_time: '2026-09-18T09:00:00.000Z' } },
  ]
  const row = buildPulseCampaignRows({ records, tables, nowYmd: '2026-09-18' })[0]
  assert.equal(row.spend_7d, 70)
  assert.equal(row.spend_today, 999)
  assert.equal(row.outcomes_today, 9)
  assert.equal(row.today_partial_included, true)
  assert.equal(row.data_fresh_through, '2026-09-18')
  assert.equal(row.last_change_at, '2026-09-18T10:45:00.000Z')
  assert.equal(row.last_sync_at, '2026-09-18T11:00:00.000Z')
})
