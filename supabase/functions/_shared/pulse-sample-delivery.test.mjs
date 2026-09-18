import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPulseSampleMessage,
  isPulseSampleDeliveryTenant,
  parsePulseSampleToPhone,
  shouldDeliverInstantPulseAlerts,
} from './pulse-sample-delivery.mjs'

test('sample phone requires approved manual trigger', () => {
  assert.equal(parsePulseSampleToPhone({ sample_to_phone: '972507677613' }, false), null)
  assert.equal(parsePulseSampleToPhone({ sample_to_phone: '972507677613' }, true), '972507677613')
  assert.equal(parsePulseSampleToPhone({ sample_to_phone: '  ' }, true), null)
})

test('sample delivery is marketingcaptain only', () => {
  assert.equal(isPulseSampleDeliveryTenant('marketingcaptain'), true)
  assert.equal(isPulseSampleDeliveryTenant('dmm'), false)
})

test('instant alerts never run on refresh-only or sample delivery', () => {
  assert.equal(shouldDeliverInstantPulseAlerts(false, null), false)
  assert.equal(shouldDeliverInstantPulseAlerts(true, '972507677613'), false)
  assert.equal(shouldDeliverInstantPulseAlerts(true, null), true)
})

test('sample message wraps the digest once', () => {
  const message = buildPulseSampleMessage('*בדיקת דופק הושלמה*\nשורה 2')
  assert.match(message, /^\*דוגמה — בדיקת דופק\*/)
  assert.match(message, /שורה 2/)
})
