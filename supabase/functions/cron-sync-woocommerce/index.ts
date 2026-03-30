import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cron job: runs every hour to sync all WooCommerce sites that have
 * woo_sync_enabled = true and is_active = true.
 *
 * Schedule in supabase/config.toml:
 *   [cron]
 *   "cron-sync-woocommerce" = "0 * * * *"  (every hour)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("[cron-sync-woocommerce] Starting hourly sync...");

    // Fetch all active WooCommerce sites with auto-sync enabled
    const { data: sites, error } = await supabase
      .from("social_media_wordpress_sites")
      .select("id, tenant_id, site_url, site_name")
      .eq("is_active", true)
      .eq("woocommerce_enabled", true)
      .eq("woo_sync_enabled", true);

    if (error) throw error;

    if (!sites || sites.length === 0) {
      console.log("[cron-sync-woocommerce] No sites to sync");
      return new Response(
        JSON.stringify({ message: "No sites to sync", sites_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cron-sync-woocommerce] Found ${sites.length} sites to sync`);

    // Invoke sync function for all sites (no site_id = sync all auto-sync sites)
    const { data: syncResult, error: syncError } = await supabase.functions.invoke(
      "sync-woocommerce-data",
      { body: {} }
    );

    if (syncError) throw syncError;

    console.log("[cron-sync-woocommerce] Sync completed:", syncResult);

    return new Response(
      JSON.stringify({
        success: true,
        sites_count: sites.length,
        result: syncResult,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[cron-sync-woocommerce] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
