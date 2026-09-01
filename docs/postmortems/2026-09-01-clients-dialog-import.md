# Postmortem: Clients module crash (missing Dialog import)

**Date:** 2026-09-01  
**Severity:** P1 — entire Clients module unusable (white screen / error boundary)  
**Fixed in:** `55bef1d0` → merged to `main` via PR #531

## Symptom

`/t/:tenant/clients` failed to load. Runtime `ReferenceError: Dialog is not defined` when `Clients.tsx` rendered.

## Root cause

1. **Accidental import deletion** — commit `a6dc7af7` ("Fix SEO role users seeing all SEO-tagged clients") replaced the `@/components/ui/dialog` import block with `isSeoTaggedClient`. The JSX still used `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>` for filters + bulk Meta sync.
2. **No compile-time gate** — `pnpm build` (Vite) does not run `tsc`; the bundle ships with the undefined identifier. ESLint on the file did not flag `Dialog` as undefined.
3. **Monolithic page file** — `src/pages/Clients.tsx` (~1,500 lines) mixes data fetching, role filters, toolbar, three view modes, dialogs, and mutations. Unrelated SEO changes touched the same import section as UI dialogs → easy to drop an import during conflict resolution / focused edits.

## Why it wasn't caught

| Gate | Would it catch? |
|------|-----------------|
| `pnpm build` | No — Vite transpiles without type-checking |
| `pnpm lint` (whole repo) | Noisy baseline; `Dialog` not reported |
| `tsc --noEmit` | **Yes** — but not in CI today; repo has many pre-existing TS errors |
| Preview smoke test | Would catch if anyone opened Clients after the SEO PR |

## Prevention (implemented / planned)

- **Done:** restore import; merged hotfix to `main`.
- **Done:** `safe-bugfix` label + GitHub Action auto-merges qualifying PRs to `main` after `pnpm build` passes.
- **Planned:** split `Clients.tsx` into `clients/` submodules (see plan below); add targeted ESLint `no-undef` on `src/pages/*.tsx`; add optional smoke route check in CI for critical modules.

## Agent / team memory

When editing a large page file:

1. **Never swap one import block for another without scanning the file for remaining usages** (`rg '<Dialog|DialogContent' <file>`).
2. **If the change is unrelated to UI primitives, keep imports in separate blocks** — don't replace dialog imports when adding lib imports.
3. **After any Clients/Leads/Tasks page edit, run `pnpm build` and grep for JSX tags without matching imports.**
4. Prefer **extracting dialogs** (`ClientsFiltersDialog.tsx`, `BulkMetaSyncDialog.tsx`) so future SEO/RLS edits don't touch dialog imports.

## Module split plan (execution deferred)

See David's request 2026-09-01 — track in a dedicated engineering ticket; do not block hotfix.
