import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keys inside configuration that reference resources of a specific tenant.
// They must be cleared on clone so the target tenant connects its own resources.
const TENANT_SCOPED_CONFIG_KEYS = new Set<string>([
  "integration_id",
  "green_api_integration_id",
  "manus_integration_id",
  "manychat_integration_id",
  "telegram_integration_id",
  "campaigner_id",
  "campaigner_ids",
  "client_id",
  "client_ids",
  "lead_id",
  "agency_id",
  "sales_person_id",
  "whatsapp_group_id",
  "group_id",
  "chat_id",
  "recipient_id",
  "recipient_ids",
  "recipients",
  "to_phone",
  "phone_number",
]);

function stripTenantRefs(value: any): any {
  if (Array.isArray(value)) return value.map(stripTenantRefs);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (TENANT_SCOPED_CONFIG_KEYS.has(k)) continue; // drop
      out[k] = stripTenantRefs(v);
    }
    return out;
  }
  return value;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const automationId: string = body?.automation_id;
    const targetTenantIds: string[] = Array.isArray(body?.target_tenant_ids) ? body.target_tenant_ids : [];

    if (!automationId || targetTenantIds.length === 0) {
      return new Response(JSON.stringify({ error: "automation_id and target_tenant_ids are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load source automation
    const { data: source, error: srcErr } = await admin
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .maybeSingle();
    if (srcErr || !source) {
      return new Response(JSON.stringify({ error: "Source automation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permissions: super_admin OR owner/admin of source tenant
    const { data: roles } = await admin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id);
    const isSuperAdmin = (roles || []).some((r: any) => r.role === "super_admin");

    const hasTenantAdminRole = (tid: string) =>
      isSuperAdmin || (roles || []).some(
        (r: any) => r.tenant_id === tid && ["owner", "admin"].includes(r.role)
      );

    if (!hasTenantAdminRole(source.tenant_id)) {
      return new Response(JSON.stringify({ error: "No permission on source automation" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Membership check for target tenants
    const { data: memberships } = await admin
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id);
    const memberTenantIds = new Set((memberships || []).map((m: any) => m.tenant_id));

    // Load flow steps once
    const { data: steps, error: stepsErr } = await admin
      .from("automation_flow_steps")
      .select("*")
      .eq("automation_id", automationId);
    if (stepsErr) throw stepsErr;

    const results: Array<{ tenant_id: string; success: boolean; new_automation_id?: string; error?: string }> = [];

    for (const targetTenantId of targetTenantIds) {
      try {
        if (targetTenantId === source.tenant_id) {
          results.push({ tenant_id: targetTenantId, success: false, error: "Cannot clone to source tenant" });
          continue;
        }
        if (!isSuperAdmin && !memberTenantIds.has(targetTenantId)) {
          results.push({ tenant_id: targetTenantId, success: false, error: "Not a member of target tenant" });
          continue;
        }
        if (!hasTenantAdminRole(targetTenantId)) {
          results.push({ tenant_id: targetTenantId, success: false, error: "No admin permission on target tenant" });
          continue;
        }

        const cleanedConfig = stripTenantRefs(source.configuration || {});
        const cleanedConditions = stripTenantRefs(source.conditions || {});

        const { data: newAutomation, error: insErr } = await admin
          .from("automations")
          .insert({
            name: source.name,
            description: source.description,
            tenant_id: targetTenantId,
            trigger_type: source.trigger_type,
            action_type: source.action_type,
            conditions: cleanedConditions,
            configuration: cleanedConfig,
            active: false, // start disabled until target tenant configures integrations
            is_flow: source.is_flow,
            source_automation_id: source.id,
            source_tenant_id: source.tenant_id,
          } as any)
          .select()
          .single();

        if (insErr || !newAutomation) {
          results.push({ tenant_id: targetTenantId, success: false, error: insErr?.message || "Insert failed" });
          continue;
        }

        // Clone flow steps with parent_step_id remap
        if (steps && steps.length > 0) {
          // Generate new IDs upfront so we can remap parents
          const idMap = new Map<string, string>();
          for (const s of steps) {
            idMap.set(s.id, crypto.randomUUID());
          }

          const newSteps = steps.map((s: any) => ({
            id: idMap.get(s.id),
            automation_id: newAutomation.id,
            tenant_id: targetTenantId,
            step_type: s.step_type,
            action_type: s.action_type,
            label: s.label,
            configuration: stripTenantRefs(s.configuration || {}),
            position_x: s.position_x,
            position_y: s.position_y,
            sort_order: s.sort_order,
            parent_step_id: s.parent_step_id ? idMap.get(s.parent_step_id) ?? null : null,
            condition_branch: s.condition_branch,
          }));

          const { error: stepsInsErr } = await admin
            .from("automation_flow_steps")
            .insert(newSteps);

          if (stepsInsErr) {
            // Roll back automation insert
            await admin.from("automations").delete().eq("id", newAutomation.id);
            results.push({ tenant_id: targetTenantId, success: false, error: `Steps: ${stepsInsErr.message}` });
            continue;
          }
        }

        results.push({ tenant_id: targetTenantId, success: true, new_automation_id: newAutomation.id });
      } catch (e: any) {
        results.push({ tenant_id: targetTenantId, success: false, error: e?.message || "Unknown error" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("clone-automation-to-tenant error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
