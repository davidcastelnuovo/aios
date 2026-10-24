# Supabase dev seed

`supabase/seeds/*.sql` loads demo data when a Supabase branch is created and on `supabase db reset`. It is listed in `supabase/config.toml` under `[db.seed]` and runs in file order. Production never runs it.

The seed is synthetic: no production data, no secrets, no integrations. Emails use `@aios.test`, phone numbers use `+972500000xxx`. Required reference data (menu items, lead statuses, pipeline stages, `ai_skills`) ships in migrations, not here; see AIO-181 for the `ai_skills` question.

## Files

| File                   | Contents                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `00_auth.sql`          | 5 login users and their email identities. `handle_new_user` creates the profiles.   |
| `10_tenancy.sql`       | 3 tenants, tenant memberships and roles.                                            |
| `20_demo_business.sql` | 3 agencies, 4 clients, 4 leads, 3 tasks, 1 campaigner with its assignments.         |
| `30_carmen.sql`        | A Carmen agent (`ai_agents`, named כרמן) in each of the 3 tenants.                  |
| `99_verify.sql`        | Fails the seed if any expected row is missing. Update the counts when you add rows. |

## Users

Every user has the password `devdev12`.

| User                     | Roles               | Tenant      |
| ------------------------ | ------------------- | ----------- |
| `admin@aios.test`        | super_admin, owner  | Demo Agency |
| `agency@aios.test`       | agency_owner, owner | Demo Agency |
| `campaigner@aios.test`   | campaigner          | Demo Agency |
| `client-owner@aios.test` | owner               | Demo Client |
| `carmen@aios.test`       | owner               | Carmen      |

## Data

| Tenant      | Agency            | Clients                   | Leads | Tasks                                |
| ----------- | ----------------- | ------------------------- | ----- | ------------------------------------ |
| Demo Agency | Demo Agency A     | Acme Dental, Beta Fitness | 2     | 1 (Acme, assigned to the campaigner) |
| Demo Agency | Demo Agency B     | Gamma Bakery              | 1     | 1                                    |
| Demo Client | Client Org Agency | Delta Studio              | 1     | 1                                    |
| Carmen      | none              | none                      | 0     | 0                                    |

## What each user sees

Measured with `supabase db reset` and row-level security as each user.

| User                     | Agencies          | Clients           | Leads | Tasks         |
| ------------------------ | ----------------- | ----------------- | ----- | ------------- |
| `admin@aios.test`        | A, B              | Acme, Beta, Gamma | 3     | 2             |
| `agency@aios.test`       | A, B              | Acme, Beta, Gamma | 3     | 2             |
| `campaigner@aios.test`   | A only            | Acme only         | 0     | 1 (Acme task) |
| `client-owner@aios.test` | Client Org Agency | Delta             | 1     | 1             |
| `carmen@aios.test`       | none              | none              | 0     | 0             |

- Super admins see a tenant's data only when `tenants.allow_super_admin_access` is true; the seed sets it on all three tenants. They are scoped to their own tenant, so `admin@` does not see Demo Client.
- `agency_owner` has no read policy on `clients`, so `agency@` also holds `owner`.
- Campaigners see agencies through `campaigner_agencies`, clients through `client_team` and tasks through `tasks.campaigner_id`. No policy gives them leads.

## Adding seed data

- Use fixed UUIDs and `on conflict do nothing` (or `where not exists`) so the seed can re-run.
- Use fake phone numbers only, and no tokens or `tenant_integrations` rows.
- Add the new rows to `99_verify.sql` and to the tables above.
- Run `supabase db reset` and check as each user that RLS shows what this doc says.
