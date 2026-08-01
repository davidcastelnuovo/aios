import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeTemplateParameter, shouldApplyDeliveryStatus } from './meta-whatsapp.ts'

test('a lead with no screening answers does not break the template send', () => {
  assert.equal(sanitizeTemplateParameter(''), '-')
  assert.equal(sanitizeTemplateParameter('   '), '-')
  assert.equal(sanitizeTemplateParameter(null), '-')
  assert.equal(sanitizeTemplateParameter('\n\n'), '-')
})

test('a multiline Q&A block collapses to one line without doubled bullets', () => {
  assert.equal(
    sanitizeTemplateParameter('• האם תוכל?: כן\n• ספרו לי בקצרה?: טסט'),
    'האם תוכל?: כן • ספרו לי בקצרה?: טסט',
  )
  assert.equal(sanitizeTemplateParameter('שורה\tאחת\nשתיים'), 'שורה • אחת • שתיים')
})

test('a parameter longer than Meta allows is truncated', () => {
  const truncated = sanitizeTemplateParameter('א'.repeat(5000))
  assert.equal(truncated.length, 1024)
  assert.ok(truncated.endsWith('…'))
})

test('delivery status only moves forward, and failure always wins', () => {
  assert.equal(shouldApplyDeliveryStatus(undefined, 'sent'), true)
  assert.equal(shouldApplyDeliveryStatus('sent', 'delivered'), true)
  assert.equal(shouldApplyDeliveryStatus('delivered', 'read'), true)
  assert.equal(shouldApplyDeliveryStatus('read', 'delivered'), false)
  assert.equal(shouldApplyDeliveryStatus('read', 'failed'), true)
  assert.equal(shouldApplyDeliveryStatus('sent', 'bogus'), false)
})
