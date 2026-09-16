# Issue tracker: Linear

Issues and PRDs for this repo live in Linear team **AIO**.
Use the available authenticated Linear integration or API for tracker operations.
If access is unavailable, prepare the issue content locally and report that it has not been published.

## Conventions

- Resolve team AIO before creating issues; do not infer a project from the team name.
- Create issues with a clear title, problem description, scope, and acceptance criteria.
- Read the issue description, comments, labels, and current workflow status before acting.
- List and search issues within AIO, using status and label filters as needed.
- Apply triage roles using `docs/agents/triage-labels.md`; preserve unrelated labels.
- Use AIO's existing workflow statuses. Mark completed work with the appropriate completed status and declined work with the appropriate canceled status, when authorized.
- Add findings and resolution details to the issue when the invoked skill or user authorizes posting.
- Return the issue identifier and URL after creating or updating it.

## When a skill says "publish to the issue tracker"

Create a Linear issue in team AIO.

## When a skill says "fetch the relevant ticket"

Resolve the Linear issue by identifier or URL and read its description, comments, labels, and status.

## Pull requests

GitHub pull requests remain code review artifacts; Linear is the issue tracker.
Follow the repository's existing branch, staging, preview, and production approval rules.
