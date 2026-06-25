// create-org-for-client — from an existing client record, spin up a fully-wired tenant:
//   • tenant created (name = client name, org_type derived from source hierarchy)
//   • primary contact becomes owner (invited if not yet a user)
//   • source tenant's integrations shared as mirror rows (shared_from_integration_id)
//   • client's social_pages and wordpress_sites shared via junction tables
//   • Carmen + automations + pipelines cloned via clone-entity-to-tenant
//
// Input:  { client_id, template_id?, share_llm?: boolean, clone_carmen?: boolean }
// Output: { tenant, owner_status, invited_email?, shared: { pages, sites, integrations }, warnings[] }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALL_MODULES = [
  "dashboard", "clients", "leads", "tasks", "agencies", "campaigners",
  "sales_people", "suppliers", "client_onboarding", "finance", "finance_view",
  "users", "tenants", "reports", "sales_dashboard", "lead_integrations",
  "time_tracking", "automations",
];

function generateSlug(name: string): string {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
  if (!slug || slug === "-" || slug.length < 2) slug = `org-${crypto.randomUUID().slice(0, 8)}`;
  return slug;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: userRoles } = await admin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id);

    const isSuperAdmin = (userRoles || []).some((r: any) => r.role === "super_admin");

    // ── Parse input ───────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { client_id, template_id, share_llm = false, clone_carmen = true } = body;

    if (!client_id) return json({ error: "client_id is required" }, 400);

    // ── Load client ───────────────────────────────────────────────────────────
    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select("id, name, contact_name, contact_email, phone, agency_id, tenant_id, meta_ads_account_id, google_ads_account_id")
      .eq("id", client_id)
      .maybeSingle();

    if (clientErr || !client) return json({ error: "Client not found" }, 404);
    const sourceTenantId: string = client.tenant_id;

    // Authorization: super_admin OR owner/team_manager of source tenant
    const ADMIN_ROLES = new Set(["owner", "team_manager", "agency_owner"]);
    const hasAccess = isSuperAdmin ||
      (userRoles || []).some((r: any) => r.tenant_id === sourceTenantId && ADMIN_ROLES.has(r.role));
    if (!hasAccess) return json({ error: "Insufficient permissions" }, 403);

    // Load source tenant for org_type hierarchy
    const { data: sourceTenant } = await admin
      .from("tenants")
      .select("org_type, parent_tenant_id")
      .eq("id", sourceTenantId)
      .maybeSingle();

    let orgType: "root" | "organization" | "sub_organization" = "organization";
    if (sourceTenant?.org_type === "root") orgType = "organization";
    else if (sourceTenant?.org_type === "organization") orgType = "sub_organization";
    else if (isSuperAdmin) orgType = "organization";

    const warnings: string[] = [];
    if (orgType === "sub_organization") {
      warnings.push("ארגון היעד יהיה תת-ארגון (ארגון המקור עצמו הוא תת-ארגון). לא ניתן ליצור רמה נוספת בהיררכיה.");
      return json({ error: "Cannot create sub-sub-organization — source is already a sub_organization" }, 400);
    }

    // ── Find primary contact ──────────────────────────────────────────────────
    const { data: contacts } = await admin
      .from("client_contacts")
      .select("contact_name, email, phone, is_primary")
      .eq("client_id", client_id)
      .order("is_primary", { ascending: false })
      .limit(1);

    const primaryContact = contacts?.[0];
    const ownerEmail = primaryContact?.email || client.contact_email;
    const ownerName  = primaryContact?.contact_name || client.contact_name || client.name;

    if (!ownerEmail) {
      warnings.push("אין אימייל לאיש קשר ראשי — לא ייוצר owner אוטומטי.");
    }

    // ── Create tenant ─────────────────────────────────────────────────────────
    const tenantName = client.name || ownerName || `ארגון ${client_id.slice(0, 6)}`;
    const baseSlug = generateSlug(tenantName);
    let slug = baseSlug;
    let slugCounter = 1;
    while (true) {
      const { data: existing } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${slugCounter++}`;
    }

    const { data: newTenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({
        name: tenantName,
        slug,
        contact_name: ownerName || null,
        contact_email: ownerEmail || null,
        parent_tenant_id: sourceTenantId,
        status: "active",
        allow_super_admin_access: true,
        org_type: orgType,
      })
      .select()
      .single();

    if (tenantErr || !newTenant) throw new Error("Failed to create tenant: " + tenantErr?.message);

    const targetTenantId: string = newTenant.id;

    // Apply template or defaults
    if (template_id) {
      await admin.rpc("copy_tenant_template", {
        _source_tenant_id: template_id,
        _target_tenant_id: targetTenantId,
      }).then(({ error: e }) => e && warnings.push("copy_tenant_template: " + e.message));
    } else {
      await admin.rpc("initialize_tenant_menu_items", { _tenant_id: targetTenantId })
        .then(({ error: e }) => e && warnings.push("menu_items: " + e.message));
      await admin.rpc("initialize_default_custom_fields", { _tenant_id: targetTenantId })
        .then(({ error: e }) => e && warnings.push("custom_fields: " + e.message));
      await admin.rpc("initialize_tenant_terminology", {
        _tenant_id: targetTenantId, _business_type: "marketing_agency",
      }).then(({ error: e }) => e && warnings.push("terminology: " + e.message));
    }

    // Add creating user as member
    await admin.from("tenant_users").insert({ tenant_id: targetTenantId, user_id: user.id, role: "owner" });
    await admin.from("user_roles").insert({ user_id: user.id, role: "owner", tenant_id: targetTenantId });

    // ── Owner / invitation ────────────────────────────────────────────────────
    let ownerStatus: "existing_user" | "invited" | "no_email" = "no_email";
    let invitedEmail: string | undefined;

    if (ownerEmail) {
      // Check if a profile with this email exists
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", ownerEmail)
        .maybeSingle();

      if (profile) {
        await admin.from("tenant_users").upsert(
          { tenant_id: targetTenantId, user_id: profile.id, role: "owner" },
          { onConflict: "tenant_id,user_id" }
        );
        await admin.from("user_roles").upsert(
          { user_id: profile.id, role: "owner", tenant_id: targetTenantId },
          { onConflict: "user_id,role,tenant_id" }
        );
        ownerStatus = "existing_user";
      } else {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await admin.from("invitation_tokens").insert({
          tenant_id: targetTenantId,
          created_by: user.id,
          token: crypto.randomUUID(),
          email: ownerEmail,
          expires_at: expiresAt.toISOString(),
          metadata: {
            role: "owner",
            fullName: ownerName,
            tenant_name: tenantName,
            modulePermissions: ALL_MODULES,
          },
        });
        ownerStatus = "invited";
        invitedEmail = ownerEmail;
      }
    }

    // ── Share integrations ────────────────────────────────────────────────────
    const { data: sourceIntegrations } = await admin
      .from("tenant_integrations")
      .select("id, integration_type, settings")
      .eq("tenant_id", sourceTenantId)
      .eq("is_active", true);

    const integrationsToShare = (sourceIntegrations || []).filter((i: any) => {
      if (i.integration_type === "llm") return share_llm;
      return true;
    });

    let sharedIntegrationCount = 0;
    for (const integ of integrationsToShare) {
      const { error: mirrorErr } = await admin.from("tenant_integrations").upsert(
        {
          tenant_id: targetTenantId,
          integration_type: integ.integration_type,
          is_active: true,
          shared_from_integration_id: integ.id,
          settings: integ.settings,
        },
        { onConflict: "tenant_id,integration_type", ignoreDuplicates: false }
      );
      if (mirrorErr) warnings.push(`integration mirror (${integ.integration_type}): ${mirrorErr.message}`);
      else sharedIntegrationCount++;
    }

    // ── Share social pages ────────────────────────────────────────────────────
    const { data: socialPages } = await admin
      .from("social_pages")
      .select("id")
      .eq("client_id", client_id);

    const pageRows = (socialPages || []).map((p: any) => ({
      social_page_id: p.id,
      tenant_id: targetTenantId,
      shared_by: user.id,
    }));

    let sharedPagesCount = 0;
    if (pageRows.length) {
      const { error: pagesErr } = await admin
        .from("social_pages_shared_tenants")
        .upsert(pageRows, { onConflict: "social_page_id,tenant_id", ignoreDuplicates: true });
      if (pagesErr) warnings.push("social_pages_shared: " + pagesErr.message);
      else sharedPagesCount = pageRows.length;
    }

    // ── Share wordpress sites ─────────────────────────────────────────────────
    const { data: wpSites } = await admin
      .from("social_media_wordpress_sites")
      .select("id")
      .eq("tenant_id", sourceTenantId);

    const siteRows = (wpSites || []).map((s: any) => ({
      site_id: s.id,
      tenant_id: targetTenantId,
      shared_by: user.id,
    }));

    let sharedSitesCount = 0;
    if (siteRows.length) {
      const { error: sitesErr } = await admin
        .from("wordpress_sites_shared_tenants")
        .upsert(siteRows, { onConflict: "site_id,tenant_id", ignoreDuplicates: true });
      if (sitesErr) warnings.push("wordpress_sites_shared: " + sitesErr.message);
      else sharedSitesCount = siteRows.length;
    }

    // ── Clone Carmen + automations + pipelines ────────────────────────────────
    let cloneResults: any[] = [];
    if (clone_carmen) {
      // Find source agent (Carmen)
      const { data: sourceAgent } = await admin
        .from("ai_agents")
        .select("id")
        .eq("tenant_id", sourceTenantId)
        .limit(1)
        .maybeSingle();

      if (sourceAgent) {
        const cloneRes = await fetch(`${supabaseUrl}/functions/v1/clone-entity-to-tenant`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            entity_type: "agent",
            entity_id: sourceAgent.id,
            target_tenant_ids: [targetTenantId],
          }),
        });
        const cloneData = await cloneRes.json().catch(() => ({}));
        cloneResults.push({ type: "agent", ...cloneData });
      }

      // Clone automations
      const { data: automations } = await admin
        .from("automations")
        .select("id")
        .eq("tenant_id", sourceTenantId)
        .eq("active", true)
        .limit(50);

      for (const aut of automations || []) {
        const res = await fetch(`${supabaseUrl}/functions/v1/clone-entity-to-tenant`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            entity_type: "automation",
            entity_id: aut.id,
            target_tenant_ids: [targetTenantId],
          }),
        });
        const d = await res.json().catch(() => ({}));
        cloneResults.push({ type: "automation", id: aut.id, ...d });
      }

      // Clone pipelines
      const { data: pipelines } = await admin
        .from("marketing_pipelines")
        .select("id")
        .eq("tenant_id", sourceTenantId)
        .eq("is_active", true)
        .limit(20);

      for (const pip of pipelines || []) {
        const res = await fetch(`${supabaseUrl}/functions/v1/clone-entity-to-tenant`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            entity_type: "pipeline",
            entity_id: pip.id,
            target_tenant_ids: [targetTenantId],
          }),
        });
        const d = await res.json().catch(() => ({}));
        cloneResults.push({ type: "pipeline", id: pip.id, ...d });
      }
    }

    return json({
      success: true,
      tenant: newTenant,
      owner_status: ownerStatus,
      invited_email: invitedEmail,
      shared: {
        integrations: sharedIntegrationCount,
        pages: sharedPagesCount,
        sites: sharedSitesCount,
      },
      clone_results: cloneResults,
      warnings,
    });
  } catch (err: any) {
    console.error("create-org-for-client error:", err);
    return json({ error: err?.message || "Internal server error" }, 500);
  }
});
