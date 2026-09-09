# Postmortem: DMM-MC dashboards missing in MarketingCaptain

**Date:** 2026-09-09  
**Severity:** P1 — MarketingCaptain owners/campaigners could not see dashboards for shared DMM-MC clients  
**Fixed in:** `cursor/fix-dmm-dashboards-display-b49b` → PR #563

## Symptom

In org **Marketing Captain**, the Dashboards tab (and client → Reports → dashboards) no longer showed dashboards linked to DMM-MC clients. Those rows still existed under the **DMM** tenant (agency home).

## Root cause

1. **Shared-agency storage** — DMM-MC dashboards live on DMM (`crm_dashboards.tenant_id = DMM`). MarketingCaptain must load them via `fetchAccessibleDashboards` (own tenant + `agency_tenant_access` / owned agencies), not `.eq('tenant_id', uiTenant)`.
2. **Fix existed** — PR #335 (`9623721f`) wired `DynamicTables` to `fetchAccessibleDashboards`.
3. **Stale-branch merge wiped it** — merge commit `31cb0a3e` ("Merge access-invite-resend into develop", part of the access/SEO work that also produced `a6dc7af7` / PR #333) took the **feature-branch** side of `DynamicTables.tsx`. That branch predated #335, still had the tenant-only query, and overwrote develop’s correct version. Same family of damage as the Clients `Dialog` import wipe (see `2026-09-01-clients-dialog-import.md`).

Evidence:

```text
develop parent (f6023426): fetchAccessibleDashboards(tenantId)
branch side  (17e7ae95): .eq('tenant_id', tenantId)
merge result (31cb0a3e): .eq('tenant_id', tenantId)   ← wrong side won
```

## Why it wasn't caught

| Gate | Would it catch? |
|------|-----------------|
| `pnpm build` | No — both versions type-check/build |
| Preview of the SEO/access PR | Only if someone opened MC → Dashboards with DMM-MC agency filter |
| Staging after merge to `develop` | **Yes** — if that surface was smoke-checked |
| Unit tests on `crmDashboards.ts` | No — helper stayed correct; call site was removed |

## Prevention (implemented)

- **Restore** `fetchAccessibleDashboards` in `DynamicTables.tsx` and client dashboard list in `ClientTablesTab.tsx`.
- **CI guard** `scripts/check-shared-agency-dashboards.mjs` — fails if DynamicTables / ClientTablesTab drop the helper or reintroduce a tenant-only `crm_dashboards` list query. Wired into `CI — frontend build`.
- **Rule for agents:** when merging a long-lived branch that touches `DynamicTables.tsx` / `Clients.tsx`, rebase onto latest `develop` first and never resolve conflicts by taking the whole stale file. Prefer re-applying the small SEO/role diff onto current tip.

## Agent / team memory

1. Shared-agency dashboards = **always** `fetchAccessibleDashboards` — never tenant-only selects for list UIs.
2. A green build does **not** prove cross-tenant list correctness — verify on Staging Preview: MarketingCaptain → Reports → דשבורדים with DMM-MC selected.
3. Stale feature branches that edit monolithic pages are high-risk; treat conflict resolution as a review of **both** parents’ critical call sites.
