import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FB_INSIGHTS_FIELD_KEYS,
  FB_INSIGHTS_FIELD_NAMES,
  FB_INSIGHTS_FIELD_TYPES,
  buildCampaignOptimizationGoalMap,
  buildInsightRecord,
} from './fbInsights.ts'

test('Facebook CRM field definitions stay aligned', () => {
  assert.equal(FB_INSIGHTS_FIELD_KEYS.length, FB_INSIGHTS_FIELD_NAMES.length)
  assert.equal(FB_INSIGHTS_FIELD_KEYS.length, FB_INSIGHTS_FIELD_TYPES.length)
})

test('dominant optimization goal is retained per campaign', () => {
  assert.deepEqual(
    buildCampaignOptimizationGoalMap([
      { campaign_id: 'c1', optimization_goal: 'THRUPLAY' },
      { campaign_id: 'c1', optimization_goal: 'THRUPLAY' },
      { campaign_id: 'c1', optimization_goal: 'LINK_CLICKS' },
      { campaign_id: 'c2', optimization_goal: null },
    ]),
    { c1: 'THRUPLAY' },
  )
})

test('messaging objective is synced as engagement with an exact conversation outcome', () => {
  const row = buildInsightRecord(
    {
      date_start: '2026-09-17',
      campaign_id: 'c1',
      campaign_name: 'Messages',
      spend: '50',
      impressions: '1000',
      reach: '800',
      frequency: '1.25',
      clicks: '30',
      actions: [
        { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '8' },
        { action_type: 'messaging_conversation_started_7d', value: '8' },
      ],
    },
    {
      c1: {
        id: 'c1',
        name: 'Messages',
        objective: 'OUTCOME_ENGAGEMENT',
        effective_status: 'ACTIVE',
        configured_status: 'ACTIVE',
      },
    },
    {},
    { c1: 'CONVERSATIONS' },
  )

  assert.equal(row.campaign_type, 'traffic')
  assert.equal(row.optimization_goal, 'CONVERSATIONS')
  assert.equal(row.result_kind, 'conversations')
  assert.equal(row.results, 8)
  assert.equal(row.conversations, 8)
  assert.equal(row.reach, 800)
  assert.equal(row.frequency, 1.25)
})
