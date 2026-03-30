import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { site_id } = await req.json();
    if (!site_id) {
      return new Response(
        JSON.stringify({ error: "site_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: site, error: siteError } = await supabase
      .from("social_media_wordpress_sites")
      .select("*")
      .eq("id", site_id)
      .single();

    if (siteError || !site) {
      return new Response(
        JSON.stringify({ success: false, error: "Site not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, any> = {};

    // ---- Test WordPress REST API ----
    try {
      const wpUrl = `${site.site_url}/wp-json/wp/v2/users/me`;
      const credentials = btoa(`${site.username}:${site.app_password}`);
      const wpResp = await fetch(wpUrl, {
        headers: { Authorization: `Basic ${credentials}` },
      });

      if (wpResp.ok) {
        const wpUser = await wpResp.json();
        results.wordpress = {
          success: true,
          user: wpUser.name || wpUser.slug,
          capabilities: wpUser.capabilities,
        };
      } else {
        const errText = await wpResp.text();
        results.wordpress = { success: false, error: `HTTP ${wpResp.status}: ${errText}` };
      }
    } catch (e: any) {
      results.wordpress = { success: false, error: e.message };
    }

    // ---- Test WooCommerce API (if enabled) ----
    if (site.woocommerce_enabled && site.woo_consumer_key && site.woo_consumer_secret) {
      try {
        const wooUrl = new URL(`${site.site_url}/wp-json/wc/v3/system_status`);
        wooUrl.searchParams.set("consumer_key", site.woo_consumer_key);
        wooUrl.searchParams.set("consumer_secret", site.woo_consumer_secret);
        const wooResp = await fetch(wooUrl.toString());

        if (wooResp.ok) {
          const wooData = await wooResp.json();
          results.woocommerce = {
            success: true,
            version: wooData.environment?.version,
            currency: wooData.settings?.currency,
          };
        } else {
          const errText = await wooResp.text();
          results.woocommerce = { success: false, error: `HTTP ${wooResp.status}: ${errText}` };
        }
      } catch (e: any) {
        results.woocommerce = { success: false, error: e.message };
      }
    }

    const overallSuccess = results.wordpress?.success === true;

    return new Response(
      JSON.stringify({
        success: overallSuccess,
        site_name: site.site_name || site.site_url,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("test-wordpress-connection error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
