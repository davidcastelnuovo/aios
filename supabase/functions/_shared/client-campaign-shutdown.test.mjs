import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCampaignShutdownJobFromBrief,
  inferShutdownScopeFromText,
  selectCampaignsForShutdown,
} from './client-campaign-shutdown.ts'

const SAMPLE = [
  { campaign_id: '1', campaign_name: 'WEBINAR | Sep launch', effective_status: 'PAUSED' },
  { campaign_id: '2', campaign_name: 'DMM_CHALLANGE | 22.9', effective_status: 'ACTIVE' },
  { campaign_id: '3', campaign_name: 'Brand always-on', effective_status: 'PAUSED' },
  { campaign_id: '4', campaign_name: 'Old archived', effective_status: 'ARCHIVED' },
]

test('general Binat shutdown uses all_client_campaigns and includes DMM_CHALLANGE', () => {
  const scope = inferShutdownScopeFromText('כל ערב 20:30 לכבות ולבדוק קמפיינים של בינת')
  assert.equal(scope.mode, 'all_client_campaigns')
  const { checked } = selectCampaignsForShutdown(SAMPLE, scope)
  const names = checked.map((c) => c.campaign_name)
  assert.ok(names.includes('DMM_CHALLANGE | 22.9'))
  assert.ok(names.includes('WEBINAR | Sep launch'))
  assert.ok(!names.includes('Old archived'))
})

test('explicit webinar-only brief narrows scope', () => {
  const scope = inferShutdownScopeFromText('רק קמפייני webinar של בינת')
  assert.equal(scope.mode, 'name_includes')
  const { checked, skipped_out_of_scope } = selectCampaignsForShutdown(SAMPLE, scope)
  assert.deepEqual(checked.map((c) => c.campaign_name), ['WEBINAR | Sep launch'])
  assert.ok(skipped_out_of_scope.some((c) => c.campaign_name.includes('DMM_CHALLANGE')))
})

test('buildCampaignShutdownJobFromBrief defaults notify + broad scope', () => {
  const job = buildCampaignShutdownJobFromBrief(
    'כיבוי קמפיינים 20:30',
    'בדיקה וכיבוי קמפיינים של Binat',
  )
  assert.ok(job)
  assert.equal(job.scope.mode, 'all_client_campaigns')
  assert.equal(job.notify_david, true)
  assert.equal(job.client_name_search, 'Binat')
})
