import assert from 'node:assert/strict'
import test from 'node:test'
import { calendarEventCancelledTaskUpdates } from './calendar-task-sync.ts'

test('cancelled calendar event marks linked task done and clears event id', () => {
  assert.deepEqual(calendarEventCancelledTaskUpdates(), {
    status: 'done',
    google_calendar_event_id: null,
  })
})
