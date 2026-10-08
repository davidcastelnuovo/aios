# Frontend TypeScript gate

Run `pnpm install --frozen-lockfile`, then `pnpm typecheck`. The gate uses the
TypeScript compiler API equivalent of `pnpm exec tsc -p tsconfig.app.json --noEmit`
and checks all frontend sources and their dependencies, including frontend test
files. The frontend enables `strict: true`, including implicit-any and null checks,
with existing strict-mode diagnostics explicitly recorded in the baseline.
It does not check the separate extension or Supabase/Deno functions. Vite
builds remain a separate check. TypeScript is pinned to 5.9.3 in the manifest and
lockfile; CI uses Node 24 and pnpm 9.

`scripts/typecheck-baseline.json` records existing debt as a multiset of relative
file paths, diagnostic codes, full messages, and the diagnostic's source span
(whitespace normalized). Line and column numbers are printed for new errors but
excluded from identity, so moving existing source down a file does not fail.
Absolute checkout paths embedded in messages are made repository-relative, so
the same diagnostics match in local and CI checkouts.
Counts detect additional copies; identity detects replacements even when the
total error count is unchanged. Identical diagnostics on identical source spans
within one file are indistinguishable except by count. A rename, changed message,
or changed offending source requires fixing the error or reviewing the new debt.

New diagnostics fail the gate. Resolved diagnostics also fail until the baseline
is reduced, so allowances cannot silently be reused later. Run
`pnpm typecheck:update` after fixes and commit the reduced baseline alongside
them. This command refuses new errors. No source suppressions or compiler-option
relaxations are required.

Initial capture, exceptional additions, and compiler upgrades use
`pnpm typecheck --accept-new`. This is an explicit capture, not approval: explain
the reason and review the resulting JSON diff in the PR. CI compares the PR
baseline with its base commit and blocks additions, increased counts, and
compiler-version changes until a maintainer with repository write access approves
the current PR head. Submitting or dismissing a review reruns frontend CI; any new
commit requires a fresh approval when adding debt. Ordinary reductions need no
extra approval from this gate. Approval of a baseline does not authorize merging
or deployment; follow the repository release rules.

## Trusted CI execution and rollout

CI checks out the PR's base commit from its target branch (normally `develop`)
separately from the proposed project. It copies the base's checker, policy module,
manifest, and lockfile into an isolated temporary directory and installs that
trusted compiler with dependency hooks disabled. The PR's dependencies are
installed with both lifecycle scripts and pnpm hooks disabled; they are read as
compiler inputs, not imported as checker code. The trusted checker runs with
`--project PATH`, which permits checking only, never updating the candidate
baseline. Compiler upgrades need the trusted tooling upgraded first.

The `baseline-review` job does not check out or execute PR code at all. It loads
the base's dependency-free `typecheck-policy.mjs` and reads both baseline JSON
files through GitHub's API at the exact base/head revisions. A reviewer permission
lookup returning 404 means that reviewer cannot approve; other API errors fail
the job. Changes to either frontend compiler configuration also require approval,
so weakening strict checks and shrinking the baseline cannot bypass review.
Approval must cover the current PR head, which is rechecked before success.

Before the target branch contains these tools, CI fails closed unless a full,
reviewed tooling commit SHA is configured as the repository secret
`TYPESCRIPT_GATE_BOOTSTRAP_SHA` (a non-sensitive SHA stored as a secret so its
configuration requires repository administrator access). A maintainer must review that commit's checker,
policy, manifest, and lockfile before configuring it; the PR cannot choose a
bootstrap ref through its files or workflow inputs. Configure the reviewed SHA,
approve the current PR head, then manually rerun the failed jobs if a review event
does not start a run. Do not push a dummy commit to retry: that invalidates approval.
The configured reviewed SHA explicitly overrides the base's tools; this also
permits a coordinated compiler/tooling upgrade against a reviewed revision.
Once the tools land on `develop`, remove the temporary bootstrap secret and CI
uses the base automatically. Missing trusted tooling never falls back to PR code.

Separate checkouts do not protect a workflow that a PR can edit or skip. Before
treating this as enforced policy, require the workflow from an independently
protected source through a repository/organization ruleset (where supported), or
an independently controlled check provider. An alternative is branch protection requiring current code-owner approval for
all workflows, trusted checker/policy files, compiler configurations, dependency
manifest/lockfile, and CODEOWNERS itself, with stale approvals dismissed.
Ordinary required check names alone do not prevent a PR from replacing the workflow
implementation; protecting only this workflow also leaves check-name spoofing
through a new workflow possible. Restrict access
to the bootstrap configuration as part of that trust policy. This PR does not
change repository rules or configure the bootstrap secret automatically.

The review trigger intentionally checks the PR merge revision, as documented for
`pull_request_review`; it does not check the default branch. Verify required-check
association during rollout and use a manual rerun of the original PR run if needed.

Compiler/configuration failures, missing or malformed baselines, and unexpected
compiler versions fail rather than being treated as zero errors. Run
`pnpm test:typecheck` for focused comparison and real-compiler regression tests.
