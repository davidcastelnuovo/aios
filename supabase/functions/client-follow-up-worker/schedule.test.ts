import assert from 'node:assert/strict'
import test from 'node:test'
import { clientFollowUpNotifyAt, isFollowUpDue } from './schedule.ts'

test('follow-up reminder fires at 08:30 Israel on the follow-up date', () => {
  const notifyAt = clientFollowUpNotifyAt('2026-08-24')
  assert.equal(notifyAt?.toISOString(), '2026-08-24T05:30:00.000Z')
})

test('follow-up is due after 08:30 Israel on the follow-up date', () => {
  assert.equal(
    isFollowUpDue('2026-08-24', new Date('2026-08-24T06:00:00.000Z')),
    true,
  )
  assert.equal(
    isFollowUpDue('2026-08-24', new Date('2026-08-24T05:00:00.000Z')),
    false,
  )
})

test('overdue follow-up is due once the original reminder time passed', () => {
  assert.equal(
    isFollowUpDue('2026-08-20', new Date('2026-08-24T10:00:00.000Z')),
    true,
  )
})
