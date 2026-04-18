

## Current state

**Cron schedule (Israel time = UTC+3):**
| Job | Schedule (UTC) | Israel time | Coverage |
|---|---|---|---|
| `cron-sync-facebook-insights` | `30 4 * * 0` | Sun 07:30 **only** | Weekly, not 2×/day |
| `cron-sync-facebook-ecommerce` | `0 5 * * *` | Daily 08:00 | Once a day |
| `cron-sync-google-ads` | `0 4 * * *` | Daily 07:00 | Once a day |
| `cron-sync-facebook-leads` | every minute | every minute | OK (leads only) |
| Google Analytics, GSC, Ahrefs | – | – | **No cron at all** |

**Carmen anomaly monitoring:**
- `cron-sync-facebook-insights` does check `report_alerts` and fires automations on blocked / paused campaigns and CPL/spend thresholds — but it only runs **once a week** so alerts effectively don't fire.
- `agent-heartbeat` exists and runs over `tenant_heartbeat_settings` (one tenant has it enabled), but `heartbeat_logs` has **0 rows** → the heartbeat cron is **not scheduled at all**, so Carmen never wakes up to monitor anything.
- No alert exists for "spend = 0 for X days" (account stopped) — only threshold alerts on CPL/spend `>` value.

## Plan

### 1. Sync GA / GSC / Ahrefs daily
Create three new cron-sync functions mirroring the FB ecommerce pattern (loop `crm_tables` by `integration_type`, invoke the existing `sync-*` per table, batched):
- `cron-sync-google-analytics`
- `cron-sync-google-search-console`
- `cron-sync-ahrefs` (manual-only comparisons preserved per existing memory — only base snapshot)

### 2. Reschedule all data syncs to 07:00 + 16:00 Israel (04:00 + 13:00 UTC)
Replace existing cron jobs and add the new ones:

```
04:00 UTC + 13:00 UTC  →  07:00 + 16:00 Israel
- cron-sync-facebook-insights   (change from weekly to 2×/day)
- cron-sync-facebook-ecommerce  (change from 05:00 to 04:00 + add 13:00)
- cron-sync-google-ads          (add 13:00)
- cron-sync-google-analytics    (NEW)
- cron-sync-google-search-console (NEW)
- cron-sync-ahrefs              (NEW)
```

### 3. Add "spend stopped" anomaly detection
Extend the alert evaluator inside `cron-sync-facebook-insights` (and add the same logic to `cron-sync-google-ads`) with a built-in check that runs every sync without requiring a manual `report_alerts` row:
- For each active campaign, if `spend = 0` for the last 2 consecutive days while it had spend in the prior 7 days → trigger automation `account_stopped_spending`.
- Existing `effective_status` block detection stays (already works).
- Push a Carmen task via `agent_tasks` so it appears in her queue and a WhatsApp reminder is sent to the assigned campaigner.

### 4. Activate Carmen heartbeat
- Schedule `agent-heartbeat` every hour via `pg_cron`.
- Extend `agent-heartbeat` to also read recent anomaly events (from step 3) and post a daily summary to the assigned campaigner via Green API.

### 5. Carmen visibility
Create one self-managed recurring `agent_tasks` row per tenant with `schedule_type='recurring'` + `cron_expression='0 5,14 * * *'` titled "ניטור חשבונות פייסבוק/גוגל" so the user sees it in Carmen's task list and can confirm it ran (`last_run`, `run_count`).

### Files touched
- New: `supabase/functions/cron-sync-google-analytics/index.ts`
- New: `supabase/functions/cron-sync-google-search-console/index.ts`
- New: `supabase/functions/cron-sync-ahrefs/index.ts`
- Edit: `supabase/functions/cron-sync-facebook-insights/index.ts` (add zero-spend anomaly)
- Edit: `supabase/functions/cron-sync-google-ads/index.ts` (add same anomaly + alert eval)
- Edit: `supabase/functions/agent-heartbeat/index.ts` (read anomaly events, daily summary)
- Migration: drop & re-create the cron jobs at 04:00 + 13:00 UTC, schedule heartbeat hourly, seed recurring `agent_tasks`.

