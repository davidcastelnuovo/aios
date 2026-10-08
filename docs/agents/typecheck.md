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

Compiler/configuration failures, missing or malformed baselines, and unexpected
compiler versions fail rather than being treated as zero errors. Run
`pnpm test:typecheck` for focused comparison and real-compiler regression tests.
