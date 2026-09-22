import assert from 'node:assert/strict'
import test from 'node:test'

function taskNotificationRecipientKey(input) {
  return String(
    input.notifyCampaignerId
      || input.campaignerId
      || input.salesPersonId
      || '',
  ).trim()
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
