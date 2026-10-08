-- Campaigners lost the clients they are assigned to in another tenant.
--
-- Reported case: הילה (hilabh5656@gmail.com) is a campaigner in MarketingCaptain
-- and is assigned to 5 clients. 3 of them (פעמית סטור, פעמית עסקים, אביאלי) live
-- in the DMM tenant under the DMM-MC agency, which is shared with
-- MarketingCaptain through agency_tenant_access. Her own session listed only the
-- MarketingCaptain ones, while an owner using "צפה בתור" saw all of them.
--
-- Why RLS on public.clients was not the problem: "Campaigners view assigned
-- clients" resolves assignments through get_user_client_ids(), a SECURITY
-- DEFINER function that reads client_team without RLS. Verified against
-- production — her session can SELECT all 5 client rows.
--
-- The gap was public.client_team itself:
--   * "Users can view client_team in their tenant" requires the client to be in
--     the reader's own tenant, so the 3 DMM rows were invisible.
--   * "Shared-agency cross-tenant client_team view" (the cross-tenant escape
--     hatch added with the DMM-MC move) is explicitly gated on
--     NOT user_is_restricted_client_viewer(), which excludes pure campaigners
--     and seo users — exactly the roles whose client list is *defined* by
--     client_team.
--
-- src/pages/Clients.tsx narrows a campaigner's list to the client ids returned
-- by a client_team query, so those 3 clients were dropped client-side. "צפה
-- בתור" runs that same query on the admin's session, which is why impersonation
-- showed the full list and hid the bug.
--
-- Fix: a user may read a client_team row whenever they can already read the
-- client it belongs to. This is the rule crm_dashboards already uses
-- ("Users can view dashboards by role scope" → user_can_access_client), and it
-- keeps client_team consistent with clients instead of applying a stricter
-- tenant boundary to the assignment rows than to the clients themselves.
--
-- Not a widening of anyone's access. Measured on production over every
-- client_team row × every user holding a role: 40 rows become visible, all to
-- 3 campaigners (הילה, Daniel Almog, דקל לובו), and every one of those rows
-- belongs to a client those users can already SELECT. Within a single tenant
-- nothing changes — the existing tenant policy is already broader, exposing all
-- assignment rows in the tenant.
--
-- user_can_access_client() is STABLE and SECURITY DEFINER, so it reads clients
-- and client_team without re-entering RLS; no policy recursion.

DROP POLICY IF EXISTS "Users can view client_team for accessible clients" ON public.client_team;

CREATE POLICY "Users can view client_team for accessible clients"
  ON public.client_team
  FOR SELECT
  TO authenticated
  USING (public.user_can_access_client(auth.uid(), client_id));
