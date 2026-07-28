import assert from 'node:assert/strict'
import test from 'node:test'
import { taskReminderAt } from './schedule.ts'

test('high priority daytime task is reminded exactly five hours later', () => {
  const reminder = taskReminderAt({
    priority: 10,
    created_at: '2026-07-28T07:00:00.000Z', // 10:00 Israel
    due_date: null,
    due_time: null,
  })
  assert.equal(reminder?.toISOString(), '2026-07-28T12:00:00.000Z')
})

test('high priority evening task waits until 08:30 the next morning', () => {
  const reminder = taskReminderAt({
    priority: 9,
    created_at: '2026-07-28T16:00:00.000Z', // 19:00 Israel; +5h is midnight
    due_date: null,
    due_time: null,
  })
  assert.equal(reminder?.toISOString(), '2026-07-29T05:30:00.000Z')
})

test('normal priority task is reminded one day before its due time', () => {
  const reminder = taskReminderAt({
    priority: 5,
    created_at: '2026-07-20T07:00:00.000Z',
    due_date: '2026-07-30',
    due_time: '14:00:00',
  })
  assert.equal(reminder?.toISOString(), '2026-07-29T11:00:00.000Z')
})

test('night due time is reminded at 19:00 on the previous calendar day', () => {
  const reminder = taskReminderAt({
    priority: 3,
    created_at: '2026-07-20T07:00:00.000Z',
    due_date: '2026-07-30',
    due_time: '02:00:00',
  })
  assert.equal(reminder?.toISOString(), '2026-07-29T16:00:00.000Z')
})
