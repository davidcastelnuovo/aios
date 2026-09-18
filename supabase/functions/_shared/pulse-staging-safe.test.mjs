import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { checkOutbound } from './integration-guard.ts'

test('staging pulse WhatsApp destination is blocked unless explicitly allowlisted', () => {
  const blocked = checkOutbound({
    appEnv: 'staging',
    stagingSafeMode: 'true',
    integration: 'whatsapp',
    destination: '972501234567',
    allowlistRaw: '',
  })
  assert.equal(blocked.decision, 'BLOCK')
  assert.equal(blocked.reason, 'empty_allowlist')

  const allowed = checkOutbound({
    appEnv: 'staging',
    stagingSafeMode: 'true',
    integration: 'whatsapp',
    destination: '972501234567',
    allowlistRaw: '972501234567',
  })
  assert.equal(allowed.decision, 'ALLOW')
  assert.equal(allowed.reason, 'allowlist_match')
})

test('pulse queue terminates at the Manus sender guarded by checkWhatsAppSend', async () => {
  const snapshot = await readFile(
    new URL('../campaign-pulse-snapshot/index.ts', import.meta.url),
    'utf8',
  )
  const sender = await readFile(
    new URL('../send-manus-wa-message/index.ts', import.meta.url),
    'utf8',
  )
  assert.match(snapshot, /claude_notify_david/)
  assert.match(sender, /checkWhatsAppSend/)
  assert.match(sender, /decision === ['"]BLOCK['"]/)
})

test('legacy Facebook monitor cannot emit duplicate KPI alerts', async () => {
  const monitor = await readFile(
    new URL('../fb-campaign-monitor/index.ts', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(monitor, /cpl_spike/)
  assert.doesNotMatch(monitor, /כרמן נתחי/)
  assert.match(monitor, /platform-operational failures/)
})
