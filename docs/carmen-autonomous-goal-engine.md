# Carmen Autonomous Goal Engine — Specification v1.0

**September 2026** | Implementation map: [`carmen-autonomous-goal-engine-implementation.md`](./carmen-autonomous-goal-engine-implementation.md)

## Core principle

Carmen does **not** finish because she "did tasks". She finishes only when success criteria are defined, verified, and **Evidence** proves the goal is fully complete.

## Architecture

| Layer | Role |
| --- | --- |
| **Cursor Direct (orchestrator brain)** | Planning, project management, delegation, efficiency review — sticky Carmen↔Cursor chat |
| **Cursor (per-goal agents)** | All technical work (code, tests, migrations, tools) |
| **Model API Router** | Fast user-facing chat only (not goal orchestration) |
| **Verifier + Completion Gate** | Truth for whether the goal is actually done |

## Goal Contract fields

| Field | Meaning |
| --- | --- |
| `objective` | Desired end state |
| `success_criteria` | Measurable completion conditions |
| `constraints` | What must not break |
| `scope` | Tenant/agency/client/environment/module |
| `evidence_required` | Proof required per criterion |
| `risk_level` | READ / SAFE_WRITE / REVERSIBLE / PRODUCTION / DESTRUCTIVE |
| `engine_status` | PLANNING → EXECUTING → VERIFYING → REPLANNING / BLOCKED / COMPLETED |

## Execution loop (persisted in DB)

1. Load Goal State  
2. Observe  
3. Evaluate progress vs criteria  
4. Select next action  
5. Route (technical → Cursor; fast reasoning → Model Router; existing → Tool)  
6. Execute (one action or small batch)  
7. Verify + store Evidence  
8. Replan on failure/new info  
9. Completion Gate → COMPLETED or schedule next run  

## Cursor-first rule

Any step requiring code, migrations, tests, debugging, or new tools **must** go through Cursor — never "solve in text only".

## Model Router profiles

| Profile | Use |
| --- | --- |
| FAST_CHAT | User-facing short replies |
| FAST_REASON | Classification, extraction, short decisions |
| DEEP_REASON | Complex non-code planning |
| TECHNICAL_EXECUTION | Cursor (not Model API) |

Failover on rate limit, quota/credit exhaustion, provider outage — goal state preserved via canonical Context Package.

## Completion Gate

`COMPLETED` only when every **required** criterion is `PASS` with fresh Evidence. Cursor "done" messages are input to Verifier, not completion proof.

## Implementation phases

See [`carmen-autonomous-goal-engine-implementation.md`](./carmen-autonomous-goal-engine-implementation.md) for phase status and code paths.
