import assert from 'node:assert/strict'
import test from 'node:test'
import { loadPulseSettings } from './pulse-settings.mjs'
import { hasPulseIntent, isCachedPulseRequest } from './pulse-request.mjs'

function client(responses) {
  const calls = []
  return { calls, from(table) {
    const call = { table }
    calls.push(call)
    return { select(columns) {
      call.columns = columns
      return { eq(key, value) { call.filter = [key, value]; return this },
        then(resolve, reject) { return Promise.resolve(responses.shift()).then(resolve, reject) } }
    } }
  } }
}

test('missing optional settings preserves tenant scope and disables instant delivery', async () => {
  for (const code of ['42703', 'PGRST204']) {
    const db = client([{ error: { code, message: 'column tenant_heartbeat_settings.pulse_alert_rules does not exist' } },
      { data: [{ tenant_id: 'tenant-a', campaign_pulse_enabled: true }], error: null }])
    const result = await loadPulseSettings(db, 'tenant-a')
    assert.equal(result.legacySchema, true)
    assert.equal(result.error, null)
    assert.equal(result.data[0].pulse_alert_rules.instant_wa_enabled, false)
    assert.equal(result.data[0].campaign_pulse_enabled, true)
    assert.deepEqual(db.calls.map(c => c.filter), [['tenant_id', 'tenant-a'], ['tenant_id', 'tenant-a']])
    assert.equal(db.calls[1].columns.includes('pulse_alert_rules'), false)
  }
})

test('deployed rules are preserved without a second query', async () => {
  const data = [{ tenant_id: 'a', pulse_alert_rules: { instant_wa_enabled: false, cpl_spike_pct: 80 } }]
  const db = client([{ data, error: null }])
  const result = await loadPulseSettings(db)
  assert.equal(result.data, data)
  assert.equal(result.legacySchema, false)
  assert.equal(db.calls.length, 1)
})

test('authorization, unrelated schema and transient failures are not hidden', async () => {
  for (const error of [
    { code: '42501', message: 'permission denied for pulse_alert_rules' },
    { code: '42703', message: 'column campaign_pulse_phone does not exist' },
    { code: '57014', message: 'statement timeout' },
  ]) {
    const db = client([{ error, data: null }])
    assert.equal((await loadPulseSettings(db, 'a')).error, error)
    assert.equal(db.calls.length, 1)
  }
})

test('failed legacy query remains an error', async () => {
  const error = { code: '42501', message: 'permission denied' }
  const db = client([{ error: { code: '42703', message: 'pulse_alert_rules missing' } }, { error, data: null }])
  assert.equal((await loadPulseSettings(db)).error, error)
})

test('Hebrew and English summary requests select the stored-data route', () => {
  for (const text of ['דופק', 'בדיקת דופק', 'תני לי דופק', 'כרמן, בדיקת דופק בבקשה!', 'מצב קמפיינים', 'pulse check']) {
    assert.equal(hasPulseIntent(text), true, text)
    assert.equal(isCachedPulseRequest(text), true, text)
  }
})

test('scoped requests keep tool routing; analysis, refresh and delivery never become a generic digest', () => {
  for (const text of ['דופק ללקוח אלפא', 'נתחי את הדופק והמליצי על שינויים', 'דופק עכשיו', 'רענני בדיקת דופק', 'שלחי בדיקת דופק ללקוח', 'pulse check for client Alpha']) {
    assert.equal(hasPulseIntent(text), true, text)
    assert.equal(isCachedPulseRequest(text), false, text)
  }
  for (const text of ['דופקים', 'מדופק', 'בדיקת תקינות מערכות', 'hello']) {
    assert.equal(hasPulseIntent(text), false, text)
    assert.equal(isCachedPulseRequest(text), false, text)
  }
})
