# Carmen Autonomous Goal Engine — Implementation Map

Spec: [`carmen-autonomous-goal-engine.md`](./carmen-autonomous-goal-engine.md) (v1.0)

## Relationship to existing Goal Execution Mode

| Existing (`goal-execution-mode`) | Autonomous Goal Engine |
| --- | --- |
| `goals.execution_mode` — human-managed milestones/blockers | `goals.autonomous_mode` — server-side loop until evidence-based completion |
| Carmen tools create/update goals on demand | Worker runs iterations on schedule; survives restarts |
| `completion_criteria` free text | Structured `goal_success_criteria` rows + `goal_evidence` |
| `dev_tasks` for Cursor | `goal_plan_steps` with `action_type=cursor` + Technical Job protocol (Phase 2) |

Both can coexist on the same `goals` row (`execution_mode` + `autonomous_mode`).

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| **1 — Core Goal Engine** | DB, Goal Contract, worker loop, scheduler, persistence | ✅ This PR |
| **2 — Cursor Execution** | Technical Job protocol, callback/status, evidence from PR/CI | Planned |
| **3 — Model Router** | Profiles, provider adapters, failover metrics | Partial (`_shared/model-router.ts` stub) |
| **4 — Verifier** | Criteria engine + completion gate | Partial (gate in engine; HTTP/SQL checks Phase 4) |
| **5 — Tool Builder** | Missing capability → Cursor sub-goal → registry | Planned |
| **6 — Safety/Observability** | Risk policy, stuck detection, audit | Partial (stuck detection + `goal_model_events`) |
| **7 — Carmen UX** | Goals panel: engine status, criteria, evidence | Planned |

## Code locations

| Component | Path |
| --- | --- |
| Migration | `supabase/migrations/20260917180000_carmen_autonomous_goal_engine_phase1.sql` |
| Engine core | `supabase/functions/_shared/autonomous-goal-engine.ts` |
| Model router | `supabase/functions/_shared/model-router.ts` |
| Worker (cron) | `supabase/functions/autonomous-goal-worker/index.ts` |
| API | `supabase/functions/goal-execution-center/index.ts` (`autonomous_*` actions) |
| Carmen tools | `run-ai-agent` — `create_autonomous_goal`, `get_autonomous_goal_status` |

## Worker schedule

pg_cron job `autonomous-goal-worker` — every minute, via `task_worker_anon_key` vault secret (same pattern as other workers).

## Acceptance (Phase 1)

- [x] Goal Contract persisted with objective, criteria, constraints, scope, risk
- [x] Loop iteration saved to `goal_loop_iterations` + `goal_actions`
- [x] Worker resumes after restart from `engine_status` + `next_run_at`
- [x] Completion Gate: `COMPLETED` only when all required criteria are `PASS`
- [x] Stuck detection → `REPLANNING` or `BLOCKED`
- [ ] Technical jobs to Cursor with structured protocol (Phase 2)
- [ ] Full provider failover chain (Phase 3)
