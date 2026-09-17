import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTaskAppLink,
  formatTaskNotificationMessage,
  resolveTaskNotificationLinkTenantId,
} from './task-notification-message.ts'

const task = {
  id: 'task-123',
  title: 'להכין דוח',
  notes: null,
  priority: 5,
  due_date: null,
  due_time: null,
}

test('task links use the recipient campaigner tenant, not the task owner', () => {
  assert.equal(
    buildTaskAppLink('task-123', 'marketingcaptain'),
    'https://aios.co.il/t/marketingcaptain/tasks?task=task-123',
  )
  assert.equal(
    buildTaskAppLink('task-123', 'dmm'),
    'https://aios.co.il/t/dmm/tasks?task=task-123',
  )
})

test('link tenant prefers the assignee campaigner home tenant over DMM/client', () => {
  const linkTenantId = resolveTaskNotificationLinkTenantId({
    notifyCreator: false,
    campaignerTenantId: 'marketing-captain-tenant',
    fallbackTenantId: 'dmm-tenant',
  })
  assert.equal(linkTenantId, 'marketing-captain-tenant')
})

test('creator notifications use the creator home tenant, not the assignee tenant', () => {
  const linkTenantId = resolveTaskNotificationLinkTenantId({
    notifyCreator: true,
    creatorHomeTenantId: 'dmm-tenant',
    campaignerTenantId: 'marketing-captain-tenant',
    fallbackTenantId: 'dmm-tenant',
  })
  assert.equal(linkTenantId, 'dmm-tenant')
})

test('new assignment identifies the person who gave the task', () => {
  const message = formatTaskNotificationMessage(
    'task_assigned',
    task,
    'לקוח בדיקה',
    'דוד',
    'דוד',
    'אנה',
    'marketingcaptain',
  )

  assert.match(message, /משימה חדשה ניתנה לך על ידי אנה/)
  assert.match(message, /להכין דוח/)
  assert.match(message, /\/t\/marketingcaptain\/tasks\?task=task-123/)
  assert.doesNotMatch(message, /https:\/\/aios\.co\.il\/tasks\?task=/)
})

test('adding a collaborator tells them they were added, with a tenant link', () => {
  const message = formatTaskNotificationMessage(
    'task_collaborator_added',
    task,
    'אביאלי',
    'אנה',
    'אנה',
    'דוד',
    'marketingcaptain',
  )
  assert.match(message, /נוספת למשימה על ידי דוד/)
  assert.match(message, /אביאלי/)
  assert.match(message, /\/t\/marketingcaptain\/tasks\?task=task-123/)
})

test('a task update names the author, the task, and the link', () => {
  const message = formatTaskNotificationMessage(
    'task_update_added',
    { ...task, notes: 'הערות פנימיות שלא אמורות להישלח' },
    'אביאלי',
    'אנה',
    'אנה',
    'דוד',
    'marketingcaptain',
    { updaterName: 'דוד', updateContent: 'יש עדכון לגבי נטישת העגלה' },
  )
  assert.match(message, /יש עדכון חדש במשימה מאת דוד/)
  assert.match(message, /להכין דוח/)
  assert.match(message, /יש עדכון לגבי נטישת העגלה/)
  assert.match(message, /\/t\/marketingcaptain\/tasks\?task=task-123/)
  assert.doesNotMatch(message, /הערות פנימיות/)
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
