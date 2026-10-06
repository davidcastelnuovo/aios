import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { requireAuth } from "../_shared/security.ts";
import { fetchOpenAiBillingStatus } from "../_shared/openai-billing-fetch.ts";
import { isSuperAdminRole, OPENAI_BILLING_REFUSAL_HE } from "../_shared/openai-billing.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Mirrored from src/components/carmen-command/access.ts — owners who see org billing. */
const COMMAND_CENTER_BILLING_EMAILS = new Set(["david.castelnuovo@gmail.com"]);

async function callerMayViewBilling(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email?.toLowerCase() ?? "";
  if (COMMAND_CENTER_BILLING_EMAILS.has(email)) return true;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role, tenant_id")
    .eq("user_id", userId);
  if (roles?.some((r) => isSuperAdminRole(r.role))) return true;

  const { data: membership } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return membership?.role === "owner" || membership?.role === "agency_owner";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const auth = await requireAuth(req);
    if (!auth || auth.kind !== "user" || !auth.userId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenant_id || "").trim();
    if (!tenantId) return json({ error: "tenant_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const allowed = await callerMayViewBilling(supabase, auth.userId, tenantId);
    if (!allowed) {
      return json({ error: OPENAI_BILLING_REFUSAL_HE, allowed: false }, 403);
    }

    const status = await fetchOpenAiBillingStatus({
      supabase,
      tenantId,
      includeTokens: body.include_tokens !== false,
    });

    return json(status);
  } catch (e: any) {
    console.error("[openai-billing-status]", e?.message ?? e);
    return json({ ok: false, error: "billing fetch failed", admin_available: false }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
