import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatAutomationStepForCarmen,
  sanitizeStepConfiguration,
} from './automation-flow-steps.ts'

test('sanitizeStepConfiguration redacts sensitive keys', () => {
  const out = sanitizeStepConfiguration({
    green_api_integration_id: 'uuid-1',
    api_key: 'secret-key',
    nested: { access_token: 'tok', message_template: 'hi' },
  })
  assert.equal(out.green_api_integration_id, 'uuid-1')
  assert.equal(out.api_key, '[REDACTED]')
  assert.equal(out.nested.access_token, '[REDACTED]')
  assert.equal(out.nested.message_template, 'hi')
})

test('formatAutomationStepForCarmen builds propose_format for action step', () => {
  const formatted = formatAutomationStepForCarmen({
    id: 'step-1',
    step_type: 'action',
    action_type: 'send_greenapi_message',
    label: 'שליחת WhatsApp',
    sort_order: 1,
    parent_step_id: 'trigger-1',
    condition_branch: null,
    configuration: {
      green_api_integration_id: 'int-1',
      message_template: 'שלום {{contact_name}}',
    },
  })
  assert.equal(formatted.propose_format.type, 'action')
  assert.equal(formatted.propose_format.action_type, 'send_greenapi_message')
  assert.equal(formatted.configuration.message_template, 'שלום {{contact_name}}')
})
