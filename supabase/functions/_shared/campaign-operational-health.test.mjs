import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  campaignStateMap,
  evaluateGoogleOperationalIssues,
} from './campaign-operational-health.ts'

test('first operational scan establishes a baseline without alerting', () => {
  assert.deepEqual(
    evaluateGoogleOperationalIssues(null, [{ id: '1', name: 'Lead', status: 'ENABLED', primary_status: 'ELIGIBLE' }]),
    [],
  )
})

test('alerts when an enabled campaign becomes blocked or paused', () => {
  const previous = campaignStateMap([
    { id: '1', name: 'Lead', status: 'ENABLED', primary_status: 'ELIGIBLE' },
    { id: '2', name: 'Shop', status: 'ENABLED', primary_status: 'ELIGIBLE' },
  ])
  const issues = evaluateGoogleOperationalIssues(previous, [
    {
      id: '1',
      name: 'Lead',
      status: 'ENABLED',
      primary_status: 'NOT_ELIGIBLE',
      primary_status_reasons: ['BILLING_SETUP'],
    },
    { id: '2', name: 'Shop', status: 'PAUSED', primary_status: 'NOT_ELIGIBLE' },
  ])
  assert.equal(issues.length, 2)
  assert.deepEqual(issues[0].details.primary_status_reasons, ['BILLING_SETUP'])
})

test('does not alert repeatedly when campaign was already stopped', () => {
  const previous = campaignStateMap([
    { id: '1', name: 'Lead', status: 'PAUSED', primary_status: 'NOT_ELIGIBLE' },
  ])
  assert.deepEqual(
    evaluateGoogleOperationalIssues(previous, [
      { id: '1', name: 'Lead', status: 'PAUSED', primary_status: 'NOT_ELIGIBLE' },
    ]),
    [],
  )
})

test('two-hour cron uses lightweight operational modes for Meta and Google', async () => {
  const migration = await readFile(
    new URL('../../migrations/20260918193000_campaign_operational_checks_every_two_hours.sql', import.meta.url),
    'utf8',
  )
  const metaMonitor = await readFile(new URL('../fb-campaign-monitor/index.ts', import.meta.url), 'utf8')
  const googleSync = await readFile(new URL('../sync-google-ads-data/index.ts', import.meta.url), 'utf8')

  assert.match(migration, /15 \*\/2 \* \* \*/)
  assert.match(migration, /25 \*\/2 \* \* \*/)
  assert.match(migration, /"operational_only":true/)
  assert.doesNotMatch(metaMonitor, /\/insights\?/)
  assert.match(metaMonitor, /account_disabled/)
  assert.match(googleSync, /campaign\.primary_status_reasons/)
  assert.match(googleSync, /evaluateGoogleOperationalIssues/)
})
