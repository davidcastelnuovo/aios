import assert from 'node:assert/strict'
import test from 'node:test'
import { formatClientFollowUpMessage } from '../_shared/client-follow-up-message.ts'

test('campaigner reminder includes client name and link', () => {
  const message = formatClientFollowUpMessage(
    'client_follow_up_reminder',
    { id: 'client-1', name: 'אורן בע״מ', follow_up_date: '2026-08-24' },
    'פליקס',
    ['פליקס'],
  )
  assert.match(message, /אורן בע״מ/)
  assert.match(message, /תאריך לשיחה: 2026-08-24/)
  assert.match(message, /clients\?client=client-1/)
})

test('manager reminder includes assignee names', () => {
  const message = formatClientFollowUpMessage(
    'client_follow_up_reminder_manager',
    { id: 'client-1', name: 'אורן בע״מ', follow_up_date: '2026-08-24' },
    'דוד',
    ['פליקס', 'מיה'],
  )
  assert.match(message, /קמפיינר משויך: פליקס, מיה/)
  assert.match(message, /הגיע הזמן לדבר/)
})
