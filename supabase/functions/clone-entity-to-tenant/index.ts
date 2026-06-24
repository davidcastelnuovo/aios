// Generic "clone entity to another organization" — a true, independent deep copy
// (NOT the read-only mirror that clone-automation-to-tenant creates).
// Supports entity_type: 'agent' | 'automation' | 'pipeline'.
// - Verifies the caller is super_admin or an admin of the SOURCE tenant.
// - Verifies the caller is a member of each TARGET tenant.
// - Deep-copies the entity + its children with fresh UUIDs into the target tenant.
// - Cloned automations/pipelines are created INACTIVE (safety: never auto-run).
// - Reports integrations referenced by the entity that are missing in the target,
//   so the user knows what to connect before activating.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_ROLES = new Set(["owner", "team_manager", "agency_owner"]);

// Known integration tokens to look for inside entity JSON. Maps a token that may
// appear in trigger/action/configuration to the canonical tenant_integrations type.
const INTEGRATION_TOKENS: Array<{ token: RegExp; type: string }> = [
  { token: /facebook|fb_lead|lead_ads/i, type: "facebook_lead_ads" },
  { token: /manychat/i, type: "manychat" },
  { token: /green_api|whatsapp|green-api/i, type: "green_api" },
  { token: /google_ads_via_make/i, type: "google_ads_via_make" },
  { token: /google_ads/i, type: "google_ads" },
  { token: /google_analytics|\bga4\b/i, type: "google_analytics" },
  { token: /google_search_console|\bgsc\b/i, type: "google_search_console" },
  { token: /dataforseo/i, type: "dataforseo" },
  { token: /ahrefs/i, type: "ahrefs" },
  { token: /\bzoom\b/i, type: "zoom" },
  { token: /\bsumit\b/i, type: "sumit" },
  { token: /make_api|\bmake\b/i, type: "make_api" },
  { token: /manus_wa/i, type: "manus_wa" },
  { token: /\bmanus\b/i, type: "manus" },
];

function newId(): string {
  return crypto.randomUUID();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const entityType: string = body?.entity_type;
    const entityId: string = body?.entity_id;
    const targetTenantIds: string[] = Array.isArray(body?.target_tenant_ids) ? body.target_tenant_ids : [];

    if (!["agent", "automation", "pipeline"].includes(entityType)) {
      return json({ error: "entity_type must be agent | automation | pipeline" }, 400);
    }
    if (!entityId || targetTenantIds.length === 0) {
      return json({ error: "entity_id and target_tenant_ids are required" }, 400);
    }

    // ---- Load source + resolve its tenant ----
    const SOURCE_TABLE: Record<string, string> = {
      agent: "ai_agents",
      automation: "automations",
      pipeline: "marketing_pipelines",
    };
    const { data: source, error: srcErr } = await admin
      .from(SOURCE_TABLE[entityType])
      .select("*")
      .eq("id", entityId)
      .maybeSingle();
    if (srcErr || !source) return json({ error: "Source entity not found" }, 404);
    const sourceTenantId: string = source.tenant_id;

    // ---- Authorization ----
    const { data: roles } = await admin
      .from("user_roles").select("role, tenant_id").eq("user_id", user.id);
    const isSuperAdmin = (roles || []).some((r: any) => r.role === "super_admin");
    const hasSourceAdmin = isSuperAdmin ||
      (roles || []).some((r: any) => r.tenant_id === sourceTenantId && ADMIN_ROLES.has(r.role));
    if (!hasSourceAdmin) return json({ error: "No permission on source entity" }, 403);

    const { data: memberships } = await admin
      .from("tenant_users").select("tenant_id").eq("user_id", user.id);
    const memberTenantIds = new Set((memberships || []).map((m: any) => m.tenant_id));

    // Integration types active in source (used to flag what the target is missing).
    const { data: srcInteg } = await admin
      .from("tenant_integrations").select("integration_type")
      .eq("tenant_id", sourceTenantId).eq("is_active", true);
    const sourceActiveTypes = new Set((srcInteg || []).map((r: any) => r.integration_type));

    // Pre-load children once (same for every target).
    let childSteps: any[] = [];
    if (entityType === "automation") {
      const { data } = await admin.from("automation_flow_steps").select("*").eq("automation_id", entityId);
      childSteps = data || [];
    } else if (entityType === "pipeline") {
      const { data } = await admin.from("marketing_pipeline_stages").select("*").eq("pipeline_id", entityId);
      childSteps = data || [];
    }

    // Detect integration types referenced by the entity (scan serialized JSON).
    const blob = JSON.stringify({ source, childSteps });
    const referencedTypes = new Set<string>();
    for (const { token, type } of INTEGRATION_TOKENS) {
      if (token.test(blob)) referencedTypes.add(type);
    }
    // For an agent there is little JSON to scan, so fall back to its tenant's active set.
    if (entityType === "agent") {
      for (const t of sourceActiveTypes) referencedTypes.add(t as string);
    }

    const results: any[] = [];
    for (const targetTenantId of targetTenantIds) {
      try {
        if (targetTenantId === sourceTenantId) {
          results.push({ tenant_id: targetTenantId, success: false, error: "אותו ארגון מקור" });
          continue;
        }
        if (!isSuperAdmin && !memberTenantIds.has(targetTenantId)) {
          results.push({ tenant_id: targetTenantId, success: false, error: "אינך חבר בארגון היעד" });
          continue;
        }

        // What is missing in the target?
        const { data: tgtInteg } = await admin
          .from("tenant_integrations").select("integration_type")
          .eq("tenant_id", targetTenantId).eq("is_active", true);
        const targetActiveTypes = new Set((tgtInteg || []).map((r: any) => r.integration_type));
        const missingIntegrations = [...referencedTypes].filter((t) => !targetActiveTypes.has(t));

        let newEntityId: string | null = null;
        let alreadyExists = false;

        if (entityType === "agent") {
          // Idempotent: if the target already has an agent, reuse it (don't duplicate Carmen).
          const { data: existing } = await admin
            .from("ai_agents").select("id").eq("tenant_id", targetTenantId).limit(1).maybeSingle();
          if (existing) {
            newEntityId = existing.id;
            alreadyExists = true;
          } else {
            newEntityId = newId();
            const { error } = await admin.from("ai_agents").insert({
              id: newEntityId,
              tenant_id: targetTenantId,
              name: source.name,
              engine: source.engine,
              personality: source.personality,
              soul: source.soul,
              talent: source.talent,
              active: true,
              allowed_tools: source.allowed_tools,
              system_prompt: source.system_prompt,
              max_tool_rounds: source.max_tool_rounds,
              description: source.description,
              mood: source.mood,
              voice: source.voice,
              disabled_tools: source.disabled_tools,
              disabled_skins: source.disabled_skins,
              disabled_integrations: source.disabled_integrations,
              language: source.language,
              response_length: source.response_length,
              writing_style: source.writing_style,
              metadata: source.metadata,
            });
            if (error) throw error;

            // Carry over the source tenant's custom (tenant-scoped) skin overrides.
            const { data: tenantSkins } = await admin
              .from("ai_skills").select("*").eq("tenant_id", sourceTenantId).eq("scope", "tenant");
            for (const sk of tenantSkins || []) {
              const { id: _omit, created_at, updated_at, search_vector, ...rest } = sk;
              await admin.from("ai_skills").insert({
                ...rest, id: newId(), tenant_id: targetTenantId, user_id: user.id,
              });
            }
          }
        } else if (entityType === "automation") {
          newEntityId = newId();
          const { error } = await admin.from("automations").insert({
            id: newEntityId,
            tenant_id: targetTenantId,
            name: source.name,
            description: source.description,
            trigger_type: source.trigger_type,
            conditions: source.conditions,
            action_type: source.action_type,
            configuration: source.configuration,
            is_flow: source.is_flow,
            active: false, // safety: never auto-run a freshly cloned automation
            source_automation_id: source.id,
            source_tenant_id: sourceTenantId,
          });
          if (error) throw error;

          // Deep-copy flow steps, remapping self-referential parent_step_id.
          const idMap = new Map<string, string>();
          for (const st of childSteps) idMap.set(st.id, newId());
          const rows = childSteps.map((st) => ({
            id: idMap.get(st.id),
            automation_id: newEntityId,
            tenant_id: targetTenantId,
            step_type: st.step_type,
            action_type: st.action_type,
            label: st.label,
            configuration: st.configuration,
            position_x: st.position_x,
            position_y: st.position_y,
            sort_order: st.sort_order,
            parent_step_id: st.parent_step_id ? idMap.get(st.parent_step_id) ?? null : null,
            condition_branch: st.condition_branch,
          }));
          if (rows.length) {
            const { error: stepsErr } = await admin.from("automation_flow_steps").insert(rows);
            if (stepsErr) throw stepsErr;
          }
        } else if (entityType === "pipeline") {
          // Remap stage.agent_id to the target tenant's agent (Carmen), else null.
          const { data: tgtAgent } = await admin
            .from("ai_agents").select("id").eq("tenant_id", targetTenantId).limit(1).maybeSingle();
          const targetAgentId = tgtAgent?.id ?? null;

          newEntityId = newId();
          const { error } = await admin.from("marketing_pipelines").insert({
            id: newEntityId,
            tenant_id: targetTenantId,
            client_id: null, // clients are tenant-specific
            name: source.name,
            track: source.track,
            is_active: false,
          });
          if (error) throw error;

          const idMap = new Map<string, string>();
          for (const st of childSteps) idMap.set(st.id, newId());
          const rows = childSteps.map((st) => ({
            id: idMap.get(st.id),
            pipeline_id: newEntityId,
            tenant_id: targetTenantId,
            stage_type: st.stage_type,
            name: st.name,
            agent_id: st.agent_id ? targetAgentId : null,
            approval_mode: st.approval_mode,
            position_x: st.position_x,
            position_y: st.position_y,
            parent_stage_id: st.parent_stage_id ? idMap.get(st.parent_stage_id) ?? null : null,
            configuration: st.configuration,
            sort_order: st.sort_order,
          }));
          if (rows.length) {
            const { error: stagesErr } = await admin.from("marketing_pipeline_stages").insert(rows);
            if (stagesErr) throw stagesErr;
          }
        }

        results.push({
          tenant_id: targetTenantId,
          success: true,
          new_id: newEntityId,
          already_exists: alreadyExists,
          missing_integrations: missingIntegrations,
        });
      } catch (e: any) {
        results.push({ tenant_id: targetTenantId, success: false, error: e?.message || "שגיאה לא ידועה" });
      }
    }

    return json({ results });
  } catch (error: any) {
    console.error("clone-entity-to-tenant error:", error);
    return json({ error: error?.message || "Internal error" }, 500);
  }
});
