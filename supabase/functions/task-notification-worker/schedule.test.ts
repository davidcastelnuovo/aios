import assert from 'node:assert/strict'
import test from 'node:test'
import { taskNotificationScope, taskReminderAt } from './schedule.ts'

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

test('manager assignment to another campaigner enables managed notifications', () => {
  assert.deepEqual(taskNotificationScope({
    taskCampaignerId: 'campaigner-b',
    taskSalesPersonId: null,
    creatorCampaignerId: 'manager-a',
    creatorSalesPersonId: null,
    creatorRoles: ['team_manager'],
  }), {
    isSelfAssigned: false,
    isManagedAssignment: true,
  })
})

test('campaigner self-assignment is silent unless a self reminder is requested', () => {
  assert.deepEqual(taskNotificationScope({
    taskCampaignerId: 'campaigner-a',
    taskSalesPersonId: null,
    creatorCampaignerId: 'campaigner-a',
    creatorSalesPersonId: null,
    creatorRoles: ['campaigner'],
  }), {
    isSelfAssigned: true,
    isManagedAssignment: false,
  })
})

test('campaigner assignment to a colleague does not enable managerial notifications', () => {
  assert.deepEqual(taskNotificationScope({
    taskCampaignerId: 'campaigner-b',
    taskSalesPersonId: null,
    creatorCampaignerId: 'campaigner-a',
    creatorSalesPersonId: null,
    creatorRoles: ['campaigner'],
  }), {
    isSelfAssigned: false,
    isManagedAssignment: false,
  })
})
