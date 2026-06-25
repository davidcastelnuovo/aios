/**
 * create-org-for-client
 * ---------------------
 * One-click: from an existing client record, create a new tenant organisation
 * that represents that client — with owner, shared connections, and an
 * optional Carmen + automations clone.
 *
 * Caller must be super_admin OR owner of the source tenant.
 *
 * Body: {
 *   client_id:      string   (required)
 *   template_id?:  string   — source tenant ID to copy template from
 *   share_llm?:    boolean  — also mirror the LLM integration (default false)
 *   clone_carmen?: boolean  — clone agent + automations (default true)
 * }
 *
 * Response: {
 *   tenant, owner_status, invited_email?,
 *   shared: { integrations, pages, sites },
 *   warnings: string[]
 * }
 */
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

const ADMIN_ROLES = new Set(["owner", "team_manager", "agency_owner", "super_admin"]);

// Integrations that are skipped by default (e.g. per-user LLM key)
const LLM_INTEGRATION_TYPE = "llm";

// Modules granted to the new org's owner
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
  if (!slug || slug.length < 2) slug = `org-${crypto.randomUUID().slice(0, 8)}`;
  return slug;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles").select("role, tenant_id").eq("user_id", user.id);
    const isSuperAdmin = (roles || []).some((r: any) => r.role === "super_admin");

    // ── Parse body ────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { client_id, template_id, share_llm = false, clone_carmen = true } = body;
    if (!client_id) return json({ error: "client_id is required" }, 400);

    // ── Load client ───────────────────────────────────────────────────────
    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select("id, name, tenant_id, contact_name, email, phone, meta_ads_account_id, google_ads_account_id")
      .eq("id", client_id)
      .maybeSingle();
    if (clientErr || !client) return json({ error: "Client not found" }, 404);

    const sourceTenantId: string = client.tenant_id;

    // ── Authorise: super_admin OR owner of source tenant ──────────────────
    const hasAccess = isSuperAdmin ||
      (roles || []).some((r: any) => r.tenant_id === sourceTenantId && ADMIN_ROLES.has(r.role));
    if (!hasAccess) return json({ error: "Insufficient permissions" }, 403);

    // ── Primary contact (prefer client_contacts, fall back to client row) ──
    const { data: contacts } = await admin
      .from("client_contacts")
      .select("contact_name, email, phone")
      .eq("client_id", client_id)
      .eq("is_primary", true)
      .limit(1);
    const primaryContact = contacts?.[0] ?? {
      contact_name: client.contact_name ?? client.name,
      email: client.email,
      phone: client.phone,
    };

    const ownerEmail: string | null = primaryContact.email ?? null;
    const ownerName: string = primaryContact.contact_name ?? client.name;

    const warnings: string[] = [];

    // ── Load source tenant (for org_type hierarchy) ───────────────────────
    const { data: sourceTenant } = await admin
      .from("tenants").select("org_type").eq("id", sourceTenantId).single();
    const sourceOrgType = sourceTenant?.org_type ?? "organization";
    let newOrgType: "organization" | "sub_organization" =
      sourceOrgType === "root" ? "organization" : "sub_organization";

    // ── Create new tenant ─────────────────────────────────────────────────
    const baseSlug = generateSlug(client.name);
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const { data: existing } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${counter++}`;
    }

    const { data: newTenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({
        name: client.name,
        slug,
        contact_name: ownerName,
        contact_email: ownerEmail,
        parent_tenant_id: sourceTenantId,
        status: "active",
        allow_super_admin_access: true,
        org_type: newOrgType,
      })
      .select()
      .single();
    if (tenantErr || !newTenant) {
      return json({ error: "Failed to create tenant: " + (tenantErr?.message ?? "unknown") }, 500);
    }
    const newTenantId: string = newTenant.id;

    // ── Initialise org (template or defaults) ─────────────────────────────
    if (template_id) {
      const { error: tmplErr } = await admin.rpc("copy_tenant_template", {
        _source_tenant_id: template_id,
        _target_tenant_id: newTenantId,
      });
      if (tmplErr) warnings.push("Template apply failed: " + tmplErr.message);
    } else {
      await admin.rpc("initialize_tenant_menu_items",      { _tenant_id: newTenantId });
      await admin.rpc("initialize_default_custom_fields",  { _tenant_id: newTenantId });
      await admin.rpc("initialize_tenant_terminology", {
        _tenant_id: newTenantId,
        _business_type: "marketing_agency",
      });
    }

    // ── Add calling user as owner so they can access the new org ─────────
    await admin.from("tenant_users").upsert({ tenant_id: newTenantId, user_id: user.id, role: "owner" },
      { onConflict: "tenant_id,user_id" });
    await admin.from("user_roles").upsert({ user_id: user.id, role: "owner", tenant_id: newTenantId },
      { onConflict: "user_id,role,tenant_id" });

    // ── Owner: existing user vs invitation ────────────────────────────────
    let ownerStatus: "existing_user" | "invited" | "no_email" = "no_email";
    let invitedEmail: string | undefined;

    if (ownerEmail) {
      // Look up by email in profiles
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", ownerEmail)
        .maybeSingle();

      if (profile) {
        // Existing user → add directly
        await admin.from("tenant_users").upsert(
          { tenant_id: newTenantId, user_id: profile.id, role: "owner" },
          { onConflict: "tenant_id,user_id" },
        );
        await admin.from("user_roles").upsert(
          { user_id: profile.id, role: "owner", tenant_id: newTenantId },
          { onConflict: "user_id,role,tenant_id" },
        );
        ownerStatus = "existing_user";
      } else {
        // New user → create invitation
        const inviteToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        const { error: inviteErr } = await admin.from("invitation_tokens").insert({
          tenant_id: newTenantId,
          created_by: user.id,
          token: inviteToken,
          email: ownerEmail,
          expires_at: expiresAt.toISOString(),
          metadata: {
            role: "owner",
            fullName: ownerName,
            tenant_name: client.name,
            modulePermissions: ALL_MODULES,
          },
        });
        if (inviteErr) warnings.push("Invitation creation failed: " + inviteErr.message);
        ownerStatus = "invited";
        invitedEmail = ownerEmail;
      }
    }

    // ── Share integrations (mirror rows with shared_from_integration_id) ──
    const { data: sourceIntegrations } = await admin
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", sourceTenantId)
      .eq("is_active", true);

    let sharedIntegrations = 0;
    for (const integ of sourceIntegrations ?? []) {
      if (!share_llm && integ.integration_type === LLM_INTEGRATION_TYPE) continue;

      // Check if mirror already exists
      const { data: existing } = await admin
        .from("tenant_integrations")
        .select("id")
        .eq("tenant_id", newTenantId)
        .eq("integration_type", integ.integration_type)
        .maybeSingle();
      if (existing) continue;

      const { error: integErr } = await admin.from("tenant_integrations").insert({
        tenant_id: newTenantId,
        integration_type: integ.integration_type,
        is_active: true,
        display_name: integ.display_name,
        settings: integ.settings,
        instance_id: integ.instance_id,
        user_id: user.id,
        shared_from_integration_id: integ.id,
      });
      if (integErr) {
        warnings.push(`Integration share failed (${integ.integration_type}): ${integErr.message}`);
      } else {
        sharedIntegrations++;
      }
    }

    // ── Share social pages (via junction table) ───────────────────────────
    const { data: clientPages } = await admin
      .from("social_pages")
      .select("id")
      .eq("client_id", client_id);

    let sharedPages = 0;
    for (const page of clientPages ?? []) {
      const { error: pageErr } = await admin
        .from("social_pages_shared_tenants")
        .upsert({ social_page_id: page.id, tenant_id: newTenantId, shared_by: user.id },
          { onConflict: "social_page_id,tenant_id" });
      if (pageErr) {
        warnings.push(`Social page share failed (${page.id}): ${pageErr.message}`);
      } else {
        sharedPages++;
      }
    }

    // ── Share WordPress sites (via junction table) ────────────────────────
    const { data: clientSites } = await admin
      .from("social_media_wordpress_sites")
      .select("id")
      .eq("tenant_id", sourceTenantId);

    let sharedSites = 0;
    for (const site of clientSites ?? []) {
      const { error: siteErr } = await admin
        .from("wordpress_sites_shared_tenants")
        .upsert({ site_id: site.id, tenant_id: newTenantId, shared_by: user.id },
          { onConflict: "site_id,tenant_id" });
      if (siteErr) {
        warnings.push(`WordPress site share failed (${site.id}): ${siteErr.message}`);
      } else {
        sharedSites++;
      }
    }

    // ── Clone Carmen + automations + pipelines ────────────────────────────
    let cloneResults: any[] = [];
    if (clone_carmen) {
      // Find the source agent (Carmen)
      const { data: sourceAgent } = await admin
        .from("ai_agents").select("id").eq("tenant_id", sourceTenantId).limit(1).maybeSingle();

      if (sourceAgent) {
        // Replicate clone-entity-to-tenant logic inline (avoids network hop)
        // ── Clone agent ──
        const { data: existingAgent } = await admin
          .from("ai_agents").select("id").eq("tenant_id", newTenantId).limit(1).maybeSingle();

        let agentId: string;
        if (existingAgent) {
          agentId = existingAgent.id;
          cloneResults.push({ type: "agent", skipped: true, id: agentId });
        } else {
          const { data: src } = await admin.from("ai_agents").select("*").eq("id", sourceAgent.id).single();
          agentId = crypto.randomUUID();
          const { error: agentErr } = await admin.from("ai_agents").insert({
            id: agentId,
            tenant_id: newTenantId,
            name: src.name, engine: src.engine, personality: src.personality,
            soul: src.soul, talent: src.talent, active: true,
            allowed_tools: src.allowed_tools, system_prompt: src.system_prompt,
            max_tool_rounds: src.max_tool_rounds, description: src.description,
            mood: src.mood, voice: src.voice, disabled_tools: src.disabled_tools,
            disabled_skins: src.disabled_skins, disabled_integrations: src.disabled_integrations,
            language: src.language, response_length: src.response_length,
            writing_style: src.writing_style, metadata: src.metadata,
          });
          if (agentErr) {
            warnings.push("Agent clone failed: " + agentErr.message);
          } else {
            // Copy tenant-scoped skins
            const { data: skins } = await admin
              .from("ai_skills").select("*").eq("tenant_id", sourceTenantId).eq("scope", "tenant");
            for (const sk of skins ?? []) {
              const { id: _id, created_at, updated_at, search_vector, ...rest } = sk;
              await admin.from("ai_skills").insert({
                ...rest, id: crypto.randomUUID(), tenant_id: newTenantId, user_id: user.id,
              });
            }
            cloneResults.push({ type: "agent", id: agentId });
          }
        }

        // ── Clone automations ──
        const { data: automations } = await admin
          .from("automations").select("*").eq("tenant_id", sourceTenantId);
        for (const auto of automations ?? []) {
          const newAutoId = crypto.randomUUID();
          const { error: autoErr } = await admin.from("automations").insert({
            id: newAutoId, tenant_id: newTenantId,
            name: auto.name, description: auto.description,
            trigger_type: auto.trigger_type, conditions: auto.conditions,
            action_type: auto.action_type, configuration: auto.configuration,
            is_flow: auto.is_flow, active: false,
            source_automation_id: auto.id, source_tenant_id: sourceTenantId,
          });
          if (autoErr) {
            warnings.push(`Automation clone failed (${auto.name}): ${autoErr.message}`);
            continue;
          }
          // Copy flow steps
          const { data: steps } = await admin
            .from("automation_flow_steps").select("*").eq("automation_id", auto.id);
          if (steps && steps.length > 0) {
            const idMap = new Map<string, string>();
            for (const st of steps) idMap.set(st.id, crypto.randomUUID());
            const rows = steps.map((st) => ({
              id: idMap.get(st.id),
              automation_id: newAutoId, tenant_id: newTenantId,
              step_type: st.step_type, action_type: st.action_type, label: st.label,
              configuration: st.configuration,
              position_x: st.position_x, position_y: st.position_y,
              sort_order: st.sort_order,
              parent_step_id: st.parent_step_id ? (idMap.get(st.parent_step_id) ?? null) : null,
              condition_branch: st.condition_branch,
            }));
            await admin.from("automation_flow_steps").insert(rows);
          }
          cloneResults.push({ type: "automation", id: newAutoId, name: auto.name });
        }

        // ── Clone pipelines ──
        const { data: pipelines } = await admin
          .from("marketing_pipelines").select("*").eq("tenant_id", sourceTenantId);
        for (const pipe of pipelines ?? []) {
          const newPipeId = crypto.randomUUID();
          const { error: pipeErr } = await admin.from("marketing_pipelines").insert({
            id: newPipeId, tenant_id: newTenantId,
            client_id: null,
            name: pipe.name, track: pipe.track, is_active: false,
          });
          if (pipeErr) {
            warnings.push(`Pipeline clone failed (${pipe.name}): ${pipeErr.message}`);
            continue;
          }
          const { data: stages } = await admin
            .from("marketing_pipeline_stages").select("*").eq("pipeline_id", pipe.id);
          if (stages && stages.length > 0) {
            const idMap = new Map<string, string>();
            for (const st of stages) idMap.set(st.id, crypto.randomUUID());
            const rows = stages.map((st) => ({
              id: idMap.get(st.id),
              pipeline_id: newPipeId, tenant_id: newTenantId,
              stage_type: st.stage_type, name: st.name,
              agent_id: st.agent_id ? agentId : null,
              approval_mode: st.approval_mode,
              position_x: st.position_x, position_y: st.position_y,
              parent_stage_id: st.parent_stage_id ? (idMap.get(st.parent_stage_id) ?? null) : null,
              configuration: st.configuration, sort_order: st.sort_order,
            }));
            await admin.from("marketing_pipeline_stages").insert(rows);
          }
          cloneResults.push({ type: "pipeline", id: newPipeId, name: pipe.name });
        }
      } else {
        warnings.push("No source agent found to clone");
      }
    }

    return json({
      success: true,
      tenant: newTenant,
      owner_status: ownerStatus,
      invited_email: invitedEmail,
      shared: {
        integrations: sharedIntegrations,
        pages: sharedPages,
        sites: sharedSites,
      },
      cloned: cloneResults,
      warnings,
    });

  } catch (err: any) {
    console.error("create-org-for-client error:", err);
    return json({ error: err?.message ?? "Internal server error" }, 500);
  }
});
