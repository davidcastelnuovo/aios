# Postmortem: Hybrid SEO staff lost report / client visibility (Anna)

**Date:** 2026-09-09  
**Severity:** P1 — אנה (קמפיינר+SEO+מנהלת צוות) could not see SEO reports (נופר זומר, Exsitu / X2)  
**Fixed in:** PR #568 → `user_has_seo_scope`, frontend `isSeo` from `campaigner.role`, crm-tables scope

## Symptom

SEO reports missing in client card **דוחות** and Dynamic Tables for hybrid SEO staff. Pure team-manager paths still worked for some surfaces; SEO-wide scope did not.

## Root cause

1. **`is_seo_staff` excludes hybrids by design** (since 2025-10): `campaigner.role` contains `SEO` **and** `קמפיינר` → `is_seo_staff = false`.
2. **No `user_roles.seo`** for Anna — she relied on team_manager + `client_team`, not the SEO app role.
3. **Morning PR #562** consolidated clients SELECT into `user_can_view_client()`, SEO branch checks only `seo` role OR `is_seo_staff` — hybrids fell through for SEO-tagged clients outside explicit assignment.
4. **Parallel permission layers** — `user_can_access_client`, `user_can_view_client`, `get_user_client_ids`, frontend `isSeoOnlyViewer`, edge `crm-tables` — not updated together.

## Prevention (implemented)

- **`user_has_seo_scope()`** — single SEO scope: `seo` role, `is_seo_staff`, or `campaigner.role @> SEO`.
- **CI guard** `scripts/check-permission-personas.mjs` + `permission-personas.config.json`:
  - Static: migrations / `useUserRole` / `crm-tables` must keep hybrid wiring.
  - Live (Staging): golden persona אנה — `user_has_seo_scope`, `user_can_access_client`, `get_user_client_ids`, `user_can_access_crm_table`.
- Wired into `pnpm test:guards` and `CI — frontend build`.

## Agent memory

When changing **any** of: `user_can_view_client`, `user_can_access_client`, `get_user_client_ids`, `is_seo_staff`, clients/crm_tables RLS, `useUserRole.isSeo`, `crm-tables` scope — run `pnpm test:guards` and extend `permission-personas.config.json` if adding a new persona class.
