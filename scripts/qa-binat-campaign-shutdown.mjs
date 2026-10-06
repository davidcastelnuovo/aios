#!/usr/bin/env node
/**
 * QA (no Meta API): proves DMM_CHALLANGE is in scope for general Binat shutdown jobs.
 * Run: node scripts/qa-binat-campaign-shutdown.mjs
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const testFile = join(root, 'supabase/functions/_shared/client-campaign-shutdown.test.mjs')
const r = spawnSync(process.execPath, ['--experimental-strip-types', '--test', testFile], { stdio: 'inherit' })
process.exit(r.status ?? 1)
