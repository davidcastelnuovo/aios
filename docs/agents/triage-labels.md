# Triage labels

Use a team-scoped issue label group named **Triage** in Linear team **AIO**.
Keep the child label names equal to the canonical roles:

| Canonical role | Child label in Triage | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

Resolve labels by their team, parent group, and child name; reuse existing matching labels rather than creating duplicates.
Linear label groups allow only one child label per group on an issue, so changing the triage role replaces the previous Triage label.
Preserve labels outside this group.
The Triage label group is separate from Linear's Triage inbox and workflow statuses.

Edit this mapping directly if the team's vocabulary changes.
