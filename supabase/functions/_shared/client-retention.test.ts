import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRetentionScan,
  hasRetentionIntent,
  rankRetentionClient,
} from './client-retention.ts'

const NOW = Date.parse('2026-09-25T08:00:00Z')
const RECENT = '2026-09-20T08:00:00Z'
const STALE = '2026-08-01T08:00:00Z'

test('churn mood and critical pulse are act-now', () => {
  const churn = rankRetentionClient({
    client_id: '1',
    client_name: 'אורן',
    mood_status: 'churn_risk',
    pulse_status: 'healthy',
    last_client_call_at: RECENT,
    has_campaign_snapshot: true,
  }, NOW)
  assert.equal(churn?.band, 'act_now')
  assert.equal(churn?.suggested_mood, 'churn_risk')

  const critical = rankRetentionClient({
    client_id: '2',
    client_name: 'בילבי',
    mood_status: 'happy',
    pulse_status: 'critical',
    last_client_call_at: RECENT,
    has_campaign_snapshot: true,
  }, NOW)
  assert.equal(critical?.band, 'act_now')
  assert.match(critical?.next_action || '', /לא לשלוח הודעה/)
})

test('stale call is act-now only for a connected campaign client', () => {
  const stale = rankRetentionClient({
    client_id: '3',
    client_name: 'דני',
    mood_status: 'happy',
    pulse_status: 'healthy',
    last_client_call_at: STALE,
    has_campaign_snapshot: true,
  }, NOW)
  assert.equal(stale?.band, 'act_now')
  assert.equal(stale?.suggested_mood, 'wavering')

  const noTable = rankRetentionClient({
    client_id: '4',
    client_name: 'רות',
    mood_status: 'happy',
    pulse_status: null,
    last_client_call_at: null,
    has_campaign_snapshot: false,
  }, NOW)
  assert.equal(noTable, null)
})

test('warning is watch and a fresh healthy client is steady', () => {
  const warning = rankRetentionClient({
    client_id: '5',
    client_name: 'גל',
    mood_status: 'happy',
    pulse_status: 'warning',
    last_client_call_at: RECENT,
    has_campaign_snapshot: true,
  }, NOW)
  assert.equal(warning?.band, 'watch')

  const scan = buildRetentionScan([
    { client_id: '5', client_name: 'גל', mood_status: 'happy', pulse_status: 'warning', last_client_call_at: RECENT, has_campaign_snapshot: true },
    { client_id: '6', client_name: 'נועה', mood_status: 'happy', pulse_status: 'healthy', last_client_call_at: RECENT, has_campaign_snapshot: true },
    { client_id: '1', client_name: 'אורן', mood_status: 'churn_risk', pulse_status: 'healthy', last_client_call_at: RECENT, has_campaign_snapshot: true },
  ], NOW)
  assert.equal(scan.act_now_count, 1)
  assert.equal(scan.watch_count, 1)
  assert.equal(scan.steady_count, 1)
  assert.equal(scan.items[0].client_name, 'אורן')
  assert.match(scan.whatsapp_digest, /לטיפול עכשיו: 1/)
  assert.match(scan.whatsapp_digest, /אין שליחה ללקוח/)
})

test('retention phrasing does not require the word pulse', () => {
  assert.equal(hasRetentionIntent('תעשי בדיקת שימור'), true)
  assert.equal(hasRetentionIntent('מה מצב הקמפיינים'), false)
})
