# Goal Execution Mode — Carmen Command Center

## Overview

David gives Carmen a business/product/operations goal. Carmen acts as **execution manager**: clarify gaps, break into milestones/tasks, execute what she can, delegate dev work to Cursor when approved, track blockers, and report progress.

**No Cursor concurrency limits** — manage dev work by priority, dedup, status, and links only.

## Command Center UI

- Header button **יעדים** → Goals view (`GoalsPanel`)
- Create goals from UI or via Carmen tools
- Dashboard per goal: milestones, blockers, linked tasks/dev tasks, pending approvals, next 3 actions

## Data model

Extends existing `goals` with `execution_mode`, `priority`, `next_action`, `completion_criteria`.

| Table | Purpose |
|-------|---------|
| `goal_milestones` | Ordered milestones |
| `goal_blockers` | Open/resolved blockers |
| `goal_events` | Audit log |
| `tasks.goal_id` | Human tasks (existing) |
| `dev_tasks.goal_id` | Cursor/Grok dev work |
| `agent_tasks.goal_id` | Scheduled agent tasks |

## API

Edge function: `goal-execution-center` (JWT)

Actions: `list`, `get`, `create`, `update`, `find_duplicates`, `add_milestone`, `add_blocker`, `resolve_blocker`, `link_task`, `report`

## Carmen tools

- `find_execution_goal_duplicates`
- `create_execution_goal`
- `get_execution_goal_report`
- `add_goal_milestone`
- `add_goal_blocker`
- `link_task_to_execution_goal`
- Plus existing `create_dev_task` with `goal_id`, approval tools unchanged

## Approvals

Mutations that already require approval (finance, Meta campaigns, broadcasts, publishing) **must** use `agent_approval_queue` — Carmen does not bypass.

## QA notes (staging / Vercel Preview)

1. Open Command Center → **יעדים**
2. Create goal "Goal Execution Mode for Carmen"
3. Verify status, milestones form via Carmen chat (`create_execution_goal` + milestones)
4. Link a task; create dev task with `goal_id`; confirm no duplicate on similar title
5. Confirm report shows blockers / next actions / pending approvals
6. Confirm no concurrency-cap language in UI or errors
