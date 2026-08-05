import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dropUnresolvedTemplateLines,
  explainMetaWhatsAppError,
  extractMetaErrorCodeFromMessage,
  sanitizeTemplateParameter,
  shouldApplyDeliveryStatus,
} from './meta-whatsapp.ts'

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

test('a line whose placeholder resolves to nothing is dropped', () => {
  const data: Record<string, string> = { lead_name: 'רון לוי', source: '' }
  const resolve = (line: string) =>
    line.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => data[key] ?? placeholder)

  const raw = ['שם הליד: {{lead_name}}', 'חברה: {{lead_company}}', 'מקור: {{source}}', 'ליד חדש התקבל'].join('\n')

  assert.equal(dropUnresolvedTemplateLines(raw, resolve), 'שם הליד: {{lead_name}}\nליד חדש התקבל')
})

test('dropping unresolved lines leaves plain text and repeated placeholders alone', () => {
  const resolve = (line: string) => line.replace(/\{\{name\}\}/g, 'דוד')
  assert.equal(dropUnresolvedTemplateLines('שלום', resolve), 'שלום')
  assert.equal(dropUnresolvedTemplateLines('{{name}} ו-{{name}}', resolve), '{{name}} ו-{{name}}')
  assert.equal(dropUnresolvedTemplateLines('{{missing}}', resolve), '')
})

test('delivery status only moves forward, and failure always wins', () => {
  assert.equal(shouldApplyDeliveryStatus(undefined, 'sent'), true)
  assert.equal(shouldApplyDeliveryStatus('sent', 'delivered'), true)
  assert.equal(shouldApplyDeliveryStatus('delivered', 'read'), true)
  assert.equal(shouldApplyDeliveryStatus('read', 'delivered'), false)
  assert.equal(shouldApplyDeliveryStatus('read', 'failed'), true)
  assert.equal(shouldApplyDeliveryStatus('sent', 'bogus'), false)
})

test('explainMetaWhatsAppError: 131049 engagement is not retryable', () => {
  const explained = explainMetaWhatsAppError(131049)
  assert.equal(explained.code, '131049')
  assert.equal(explained.retryable, false)
  assert.match(explained.messageHe, /131049/)
  assert.match(explained.opsHintHe, /Quality Rating|מעורבות|איכות/)
})

test('explainMetaWhatsAppError: 131042 payment points to billing', () => {
  const explained = explainMetaWhatsAppError('131042')
  assert.equal(explained.retryable, false)
  assert.match(explained.opsHintHe, /Billing|תשלום/)
})

test('extractMetaErrorCodeFromMessage reads Hebrew delivery log text', () => {
  assert.equal(
    extractMetaErrorCodeFromMessage(
      'Meta לא מסרה את ההודעה (קוד 131049): In order to maintain a healthy ecosystem engagement',
    ),
    '131049',
  )
  assert.equal(
    extractMetaErrorCodeFromMessage(
      '(#200) You do not have the necessary permissions to send messages',
    ),
    '200',
  )
})
