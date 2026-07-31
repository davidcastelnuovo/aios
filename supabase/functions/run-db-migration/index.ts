// One-shot prod DDL runner for SEO monthly shares (+ work jsonb if missing).
// Uses service role via rpc('run_ddl_once'). Invoke once after deploy, then neutralize.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const ddl = [
  `ALTER TABLE public.seo_monthly_updates ADD COLUMN IF NOT EXISTS work jsonb NOT NULL DEFAULT '{}'::jsonb`,
  `COMMENT ON COLUMN public.seo_monthly_updates.work IS 'Monthly SEO work log: { summary, onsite[], articles[], links[] }. Used by the SEO report "עבודה חודשית" tab.'`,
  `CREATE TABLE IF NOT EXISTS public.seo_monthly_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  share_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, month)
)`,
  `CREATE INDEX IF NOT EXISTS idx_seo_monthly_shares_token ON public.seo_monthly_shares (share_token) WHERE is_active = true`,
  `CREATE INDEX IF NOT EXISTS idx_seo_monthly_shares_client ON public.seo_monthly_shares (client_id, month DESC)`,
  `ALTER TABLE public.seo_monthly_shares ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "seo_monthly_shares_tenant_access" ON public.seo_monthly_shares`,
  `CREATE POLICY "seo_monthly_shares_tenant_access" ON public.seo_monthly_shares FOR ALL TO authenticated USING (tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id)) WITH CHECK (tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()) OR is_super_admin(auth.uid()) OR user_has_cross_tenant_client_access(auth.uid(), client_id))`,
  `COMMENT ON TABLE public.seo_monthly_shares IS 'Public slideshow shares for SEO monthly work reports. snapshot is frozen at share/update time.'`,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const results: { sql: string; result: string }[] = [];

  for (const sql of ddl) {
    const { data, error } = await db.rpc("run_ddl_once", { sql });
    results.push({
      sql: sql.replace(/\s+/g, " ").slice(0, 100),
      result: error ? error.message : String(data || "ok"),
    });
  }

  const failed = results.filter((r) => r.result !== "ok");
  return new Response(
    JSON.stringify({
      success: failed.length === 0,
      applied: results.length,
      failed: failed.length,
      results,
    }),
    { status: failed.length === 0 ? 200 : 500, headers: cors },
  );
});
