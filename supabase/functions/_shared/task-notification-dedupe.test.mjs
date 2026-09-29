import assert from 'node:assert/strict'
import test from 'node:test'

function taskNotificationRecipientKey(input) {
  const recipient = String(
    input.notifyCampaignerId
      || input.campaignerId
      || input.salesPersonId
      || '',
  ).trim()
  const eventKey = String(input.eventKey || '').trim()
  return eventKey ? `${recipient}:${eventKey}` : recipient
}

function taskUpdateEventKey(content) {
  let hash = 5381
  const text = String(content || '').trim()
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

test('recipient key prefers explicit notify campaigner override', () => {
  assert.equal(
    taskNotificationRecipientKey({
      notifyCampaignerId: 'leon',
      campaignerId: 'other',
    }),
    'leon',
  )
})

test('recipient key falls back to assignee campaigner then sales person', () => {
  assert.equal(
    taskNotificationRecipientKey({
      campaignerId: 'leon',
      salesPersonId: 'sales-1',
    }),
    'leon',
  )
  assert.equal(
    taskNotificationRecipientKey({
      salesPersonId: 'sales-1',
    }),
    'sales-1',
  )
})

test('task updates keep a distinct key per comment', () => {
  const first = taskNotificationRecipientKey({
    notifyCampaignerId: 'daniel',
    eventKey: taskUpdateEventKey('מה עם הגרפיקה?'),
  })
  const second = taskNotificationRecipientKey({
    notifyCampaignerId: 'daniel',
    eventKey: taskUpdateEventKey('זה בנוי בקלוד'),
  })
  assert.notEqual(first, second)
  assert.match(first, /^daniel:[0-9a-f]+$/)
})
