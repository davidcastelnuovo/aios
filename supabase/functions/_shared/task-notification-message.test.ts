import assert from 'node:assert/strict'
import test from 'node:test'
import { formatTaskNotificationMessage } from './task-notification-message.ts'

const task = {
  id: 'task-123',
  title: 'להכין דוח',
  notes: null,
  priority: 5,
  due_date: null,
  due_time: null,
}

test('new assignment identifies the person who gave the task', () => {
  const message = formatTaskNotificationMessage(
    'task_assigned',
    task,
    'לקוח בדיקה',
    'דוד',
    'דוד',
    'אנה',
  )

  assert.match(message, /משימה חדשה ניתנה לך על ידי אנה/)
  assert.match(message, /להכין דוח/)
  assert.match(message, /\/tasks\?task=task-123/)
})

test('legacy unattributed assignment still has a useful fallback message', () => {
  const message = formatTaskNotificationMessage(
    'task_assigned',
    task,
    'משימה כללית',
    'דוד',
    'דוד',
    '',
  )

  assert.match(message, /משימה חדשה שויכה אליך/)
  assert.doesNotMatch(message, /על ידי/)
})

