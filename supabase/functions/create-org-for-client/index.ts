// create-org-for-client — from an existing client record, spin up a fully-wired tenant:
//   • tenant created (name = client name, org_type derived from source hierarchy)
//   • primary contact becomes owner (invited if not yet a user)
//   • selected integrations shared via integration_tenant_access
//   • selected social_pages / wordpress_sites / crm_tables shared via junction tables
//   • optional client profile copied into the new tenant
//   • selected automations (+ optional Carmen) cloned via clone-entity-to-tenant
//
// Input: {
//   client_id,
//   template_id?,
//   share_llm?: boolean,
//   clone_carmen?: boolean,
//   copy_client_details?: boolean,
//   share_integration_ids?: string[],
//   share_social_page_ids?: string[],
//   share_wordpress_site_ids?: string[],
//   share_crm_table_ids?: string[],
//   share_automation_ids?: string[],
// }
// Output: { tenant, owner_status, invited_email?, shared: {...}, warnings[] }

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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

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

    const body = await req.json().catch(() => ({}));
    const {
      client_id,
      template_id,
      share_llm = false,
      clone_carmen = true,
      copy_client_details = true,
      share_integration_ids,
      share_social_page_ids,
      share_wordpress_site_ids,
      share_crm_table_ids,
      share_automation_ids,
    } = body;

    const selectedIntegrationIds = asStringArray(share_integration_ids);
    const selectedPageIds = asStringArray(share_social_page_ids);
    const selectedSiteIds = asStringArray(share_wordpress_site_ids);
    const selectedTableIds = asStringArray(share_crm_table_ids);
    const selectedAutomationIds = asStringArray(share_automation_ids);

    if (!client_id) return json({ error: "client_id is required" }, 400);

    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select(`
        id, name, contact_name, contact_email, phone, email, agency_id, tenant_id,
        industry, monthly_budget, start_date, status, website, notes, folder_link,
        retainer, is_seo_client, manychat_subscriber_id, active_chat_provider,
        mood_status, whatsapp_avatar_url, attachments, folder_links, whatsapp_group_id,
        end_date, tier, services, health_score, overall_status, active_flags,
        meta_ads_account_id, google_ads_account_id, ga_property_id, gsc_site_url,
        ahrefs_domain, monthly_fixed_expense, is_ecommerce
      `)
      .eq("id", client_id)
      .maybeSingle();

    if (clientErr || !client) return json({ error: "Client not found" }, 404);
    const sourceTenantId: string = client.tenant_id;

    const ADMIN_ROLES = new Set(["owner", "team_manager", "agency_owner"]);
    const hasAccess = isSuperAdmin ||
      (userRoles || []).some((r: any) => r.tenant_id === sourceTenantId && ADMIN_ROLES.has(r.role));
    if (!hasAccess) return json({ error: "Insufficient permissions" }, 403);

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

    const { data: contacts } = await admin
      .from("client_contacts")
      .select("contact_name, email, phone, is_primary")
      .eq("client_id", client_id)
      .order("is_primary", { ascending: false });

    const primaryContact = contacts?.[0];
    const ownerEmail = primaryContact?.email || client.contact_email || client.email;
    const ownerName  = primaryContact?.contact_name || client.contact_name || client.name;

    if (!ownerEmail) {
      warnings.push("אין אימייל לאיש קשר ראשי — לא ייוצר owner אוטומטי.");
    }

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

    await admin.from("tenant_users").insert({ tenant_id: targetTenantId, user_id: user.id, role: "owner" });
    await admin.from("user_roles").insert({ user_id: user.id, role: "owner", tenant_id: targetTenantId });

    let ownerStatus: "existing_user" | "invited" | "no_email" = "no_email";
    let invitedEmail: string | undefined;

    if (ownerEmail) {
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

    // ── Copy client profile into the new tenant ───────────────────────────────
    let copiedClientId: string | null = null;
    if (copy_client_details) {
      const { data: agency, error: agencyErr } = await admin
        .from("agencies")
        .insert({
          tenant_id: targetTenantId,
          name: tenantName,
          is_default: true,
          status: "active",
        })
        .select("id")
        .single();

      if (agencyErr || !agency) {
        warnings.push("copy_client_details (agency): " + (agencyErr?.message || "failed"));
      } else {
        const {
          id: _id, agency_id: _agencyId, tenant_id: _tenantId, created_at, updated_at,
          ...clientFields
        } = client as Record<string, unknown>;

        const { data: newClient, error: newClientErr } = await admin
          .from("clients")
          .insert({
            ...clientFields,
            tenant_id: targetTenantId,
            agency_id: agency.id,
            name: client.name,
          })
          .select("id")
          .single();

        if (newClientErr || !newClient) {
          warnings.push("copy_client_details (client): " + (newClientErr?.message || "failed"));
        } else {
          copiedClientId = newClient.id;
          const contactRows = (contacts || []).map((c: any) => ({
            client_id: newClient.id,
            contact_name: c.contact_name,
            email: c.email,
            phone: c.phone,
            is_primary: !!c.is_primary,
          }));
          if (contactRows.length) {
            const { error: contactsErr } = await admin.from("client_contacts").insert(contactRows);
            if (contactsErr) warnings.push("copy_client_details (contacts): " + contactsErr.message);
          }
        }
      }
    }

    // ── Share selected integrations (integration_tenant_access) ───────────────
    let sharedIntegrationCount = 0;
    if (selectedIntegrationIds.length) {
      const { data: sourceIntegrations, error: integLoadErr } = await admin
        .from("tenant_integrations")
        .select("id, integration_type")
        .eq("tenant_id", sourceTenantId)
        .eq("is_active", true)
        .in("id", selectedIntegrationIds);

      if (integLoadErr) warnings.push("integrations load: " + integLoadErr.message);

      for (const integ of sourceIntegrations || []) {
        if (integ.integration_type === "llm" && !share_llm) continue;
        const { error: accessErr } = await admin.from("integration_tenant_access").upsert(
          {
            integration_id: integ.id,
            accessing_tenant_id: targetTenantId,
            granted_by: user.id,
          },
          { onConflict: "integration_id,accessing_tenant_id", ignoreDuplicates: true }
        );
        if (accessErr) warnings.push(`integration access (${integ.integration_type}): ${accessErr.message}`);
        else sharedIntegrationCount++;
      }
    }

    if (share_llm) {
      const { data: llmIntegration } = await admin
        .from("tenant_integrations")
        .select("id")
        .eq("tenant_id", sourceTenantId)
        .eq("integration_type", "llm")
        .eq("is_active", true)
        .maybeSingle();

      if (llmIntegration?.id) {
        const { error: llmErr } = await admin.from("integration_tenant_access").upsert(
          {
            integration_id: llmIntegration.id,
            accessing_tenant_id: targetTenantId,
            granted_by: user.id,
          },
          { onConflict: "integration_id,accessing_tenant_id", ignoreDuplicates: true }
        );
        if (llmErr) warnings.push("integration access (llm): " + llmErr.message);
        else sharedIntegrationCount++;
      }
    }

    // ── Share selected social pages ───────────────────────────────────────────
    let sharedPagesCount = 0;
    if (selectedPageIds.length) {
      const { data: socialPages, error: pagesLoadErr } = await admin
        .from("social_pages")
        .select("id")
        .eq("client_id", client_id)
        .in("id", selectedPageIds);

      if (pagesLoadErr) warnings.push("social_pages load: " + pagesLoadErr.message);

      const pageRows = (socialPages || []).map((p: any) => ({
        social_page_id: p.id,
        tenant_id: targetTenantId,
        shared_by: user.id,
      }));

      if (pageRows.length) {
        const { error: pagesErr } = await admin
          .from("social_pages_shared_tenants")
          .upsert(pageRows, { onConflict: "social_page_id,tenant_id", ignoreDuplicates: true });
        if (pagesErr) warnings.push("social_pages_shared: " + pagesErr.message);
        else sharedPagesCount = pageRows.length;
      }
    }

    // ── Share selected wordpress sites (client-scoped only) ───────────────────
    let sharedSitesCount = 0;
    if (selectedSiteIds.length) {
      const { data: wpSites, error: sitesLoadErr } = await admin
        .from("social_media_wordpress_sites")
        .select("id")
        .eq("tenant_id", sourceTenantId)
        .eq("client_id", client_id)
        .in("id", selectedSiteIds);

      if (sitesLoadErr) warnings.push("wordpress_sites load: " + sitesLoadErr.message);

      const siteRows = (wpSites || []).map((s: any) => ({
        site_id: s.id,
        tenant_id: targetTenantId,
        shared_by: user.id,
      }));

      if (siteRows.length) {
        const { error: sitesErr } = await admin
          .from("wordpress_sites_shared_tenants")
          .upsert(siteRows, { onConflict: "site_id,tenant_id", ignoreDuplicates: true });
        if (sitesErr) warnings.push("wordpress_sites_shared: " + sitesErr.message);
        else sharedSitesCount = siteRows.length;
      }
    }

    // ── Share selected CRM tables ─────────────────────────────────────────────
    let sharedTablesCount = 0;
    if (selectedTableIds.length) {
      const { data: tables, error: tablesLoadErr } = await admin
        .from("crm_tables")
        .select("id")
        .eq("tenant_id", sourceTenantId)
        .eq("client_id", client_id)
        .in("id", selectedTableIds);

      if (tablesLoadErr) warnings.push("crm_tables load: " + tablesLoadErr.message);

      const tableRows = (tables || []).map((t: any) => ({
        crm_table_id: t.id,
        tenant_id: targetTenantId,
        shared_by: user.id,
      }));

      if (tableRows.length) {
        const { error: tablesErr } = await admin
          .from("crm_tables_shared_tenants")
          .upsert(tableRows, { onConflict: "crm_table_id,tenant_id", ignoreDuplicates: true });
        if (tablesErr) warnings.push("crm_tables_shared: " + tablesErr.message);
        else sharedTablesCount = tableRows.length;
      }
    }

    // ── Clone Carmen + selected automations ───────────────────────────────────
    let cloneResults: any[] = [];
    if (clone_carmen) {
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
    }

    if (selectedAutomationIds.length) {
      const { data: automations, error: automationsErr } = await admin
        .from("automations")
        .select("id")
        .eq("tenant_id", sourceTenantId)
        .eq("active", true)
        .in("id", selectedAutomationIds);

      if (automationsErr) warnings.push("automations load: " + automationsErr.message);

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
    }

    return json({
      success: true,
      tenant: newTenant,
      owner_status: ownerStatus,
      invited_email: invitedEmail,
      copied_client_id: copiedClientId,
      shared: {
        integrations: sharedIntegrationCount,
        pages: sharedPagesCount,
        sites: sharedSitesCount,
        tables: sharedTablesCount,
        automations: selectedAutomationIds.length,
      },
      clone_results: cloneResults,
      warnings,
    });
  } catch (err: any) {
    console.error("create-org-for-client error:", err);
    return json({ error: err?.message || "Internal server error" }, 500);
  }
});
