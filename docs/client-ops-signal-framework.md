# Client Ops — Signal → Playbook framework

> **Alignment:** Problems are **typed signals**, not one-off rules. Detectors emit facts; playbooks define **who gets the task**, **what to verify**, and **when to auto-act**. Carmen (or cron) executes playbooks — not hardcoded «בינת / המרות».

## Layers

| Layer | Responsibility |
|--------|----------------|
| **Detectors** | Rule-based (no LLM): Green group SLA, commitments, pulse, alerts, card gaps → `OperationalSignal` |
| **Playbooks** | Per-tenant rows in `client_ops_playbooks`: assignee policy, task templates, verification checklist, `auto_execute` |
| **Recommendations** | Durable queue (`client_operation_recommendations`) with `signal_kind`, `problem_summary`, plans |
| **Execute** | `execute_client_operation_playbook` / auto after scan → `tasks` + `client_updates` + optional COCL follow-up |
| **Verify** | `run_client_operation_verification` replays checklist (pulse, group reply, open task) |

## Signal kinds (extensible)

- `comms.group_client_unanswered` — inbound question in Green CRM group, no staff reply in SLA
- `comms.group_staff_commitment_unfulfilled` — staff promise language, no «done» follow-up in thread
- `comms.card_weekly_missing_from_group` — weekly-like post in group, missing on client card
- `performance.critical_campaign_alert` — open critical campaign alert
- `performance.pulse_degraded` — pulse warning/critical
- `relationship.client_call_stale` — no logged client call in 14d while pulse active

New business cases = **new detector → existing or new playbook**, not a fork in Carmen’s prompt.

## Assignee policy (JSON)

```json
{ "strategy": "client_primary_campaigner" }
```

| strategy | Resolves to |
|----------|-------------|
| `client_primary_campaigner` | First `client_team.campaigner_id` for client |
| `user_email` | `profiles` / auth user by email on tenant |
| `none` | Task without campaigner (rare) |

## Verification checks (JSON array)

Examples: `green_group_reply_after`, `pulse_status`, `open_task_exists`, `client_call_logged_since`.

Carmen uses results to **follow up** — not to auto-mutate Meta or reply in Green groups.

## WhatsApp

- Green API groups: **read-only** monitoring (`chat_messages.provider=green_api`).
- Manus groups: separate allowlist (`carmen_client_group_access`).

See `docs/campaign-operations-control-layer.md` §22.
