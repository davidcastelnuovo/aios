// Fetch a fresh Ahrefs snapshot (overview + organic keywords) for a given
// domain and persist it via the ahrefs-webhook so all downstream side-effects
// (SEO crm_table auto-creation, crm_records seeding) happen in one place.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ahrefsApiKey = Deno.env.get("AHREFS_API_KEY");

    if (!ahrefsApiKey) {
      return new Response(JSON.stringify({ error: "Ahrefs API key not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { clientId, domain: rawDomain, country = "il" } = body as {
      clientId?: string;
      domain?: string;
      country?: string;
    };

    if (!clientId) {
      return new Response(JSON.stringify({ error: "Missing clientId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve domain: param > client.website
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, website, agency_id, tenant_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizeDomain = (s: string | null | undefined) =>
      (s || "")
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
        .trim();

    const domain = normalizeDomain(rawDomain || client.website);
    if (!domain) {
      return new Response(
        JSON.stringify({ error: "No domain available — set the client website or pass a domain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strategy: try multiple modes (subdomains/exact/domain) and dates.
    // For new Ahrefs projects there might be no historical snapshot for the
    // exact target/protocol/mode combo, so we fall back gracefully.
    const today = new Date().toISOString().split("T")[0];
    const tryDates: string[] = [today];
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      tryDates.push(d.toISOString().split("T")[0]);
    }

    const tryModes: Array<{ mode: string; protocol: string }> = [
      { mode: "subdomains", protocol: "both" },
      { mode: "exact", protocol: "both" },
      { mode: "domain", protocol: "both" },
      { mode: "subdomains", protocol: "https" },
    ];

    // 1) Domain overview (snapshot) — try mode/protocol combos, then dates
    let overviewJson: any = null;
    let usedDate: string | null = null;
    let usedMode = "subdomains";
    let usedProtocol = "both";
    let lastErr = "";
    let lastStatus = 0;

    outer: for (const { mode, protocol } of tryModes) {
      for (const d of tryDates) {
        const overviewUrl = `https://api.ahrefs.com/v3/site-explorer/metrics?target=${encodeURIComponent(domain)}&date=${d}&protocol=${protocol}&mode=${mode}&output=json&volume_mode=monthly`;
        const overviewRes = await fetch(overviewUrl, {
          headers: { Authorization: `Bearer ${ahrefsApiKey}`, Accept: "application/json" },
        });
        if (overviewRes.ok) {
          overviewJson = await overviewRes.json();
          usedDate = d;
          usedMode = mode;
          usedProtocol = protocol;
          console.log(`Ahrefs overview OK: domain=${domain} date=${d} mode=${mode} protocol=${protocol}`);
          break outer;
        }
        lastErr = await overviewRes.text();
        lastStatus = overviewRes.status;
        console.warn(`Ahrefs overview failed: domain=${domain} date=${d} mode=${mode} protocol=${protocol} status=${overviewRes.status} body=${lastErr.slice(0, 200)}`);
        // 401/403 = auth issue, no point continuing
        if (overviewRes.status === 401 || overviewRes.status === 403) {
          break outer;
        }
      }
    }

    if (!overviewJson || !usedDate) {
      return new Response(
        JSON.stringify({
          error: "Ahrefs overview fetch failed",
          details: lastErr || "No snapshot found",
          status: lastStatus,
          domain,
          hint: lastStatus === 404
            ? "אין snapshot זמין ב-Ahrefs עבור הדומיין הזה. ייתכן שהפרויקט נוצר זה עתה ו-Ahrefs עדיין לא ביצעה crawl ראשון (תהליך שיכול לקחת 24-48 שעות)."
            : lastStatus === 401 || lastStatus === 403
            ? "מפתח Ahrefs API לא תקין או חסר הרשאות."
            : "בדוק שהדומיין נכון ושיש לך גישה אליו ב-Ahrefs.",
        }),
        { status: lastStatus === 401 || lastStatus === 403 ? 401 : 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const m = overviewJson?.metrics || overviewJson || {};
    const reportDate = usedDate;

    // 2) Organic keywords (top ~500) — use the same mode/protocol that worked
    const kwUrl = `https://api.ahrefs.com/v3/site-explorer/organic-keywords?target=${encodeURIComponent(domain)}&date=${reportDate}&country=${country}&protocol=${usedProtocol}&mode=${usedMode}&output=json&limit=500&select=keyword,volume,keyword_difficulty,cpc,traffic,position,url`;
    const kwRes = await fetch(kwUrl, {
      headers: { Authorization: `Bearer ${ahrefsApiKey}`, Accept: "application/json" },
    });
    let organic_keywords: any[] = [];
    if (kwRes.ok) {
      const kwJson = await kwRes.json();
      organic_keywords = (kwJson?.keywords || []).map((k: any) => ({
        keyword: k.keyword,
        position: k.position,
        traffic: k.traffic,
        volume: k.volume,
        kd: k.keyword_difficulty,
        cpc: k.cpc,
        url: k.url,
      }));
    } else {
      console.warn("Ahrefs organic-keywords fetch failed:", await kwRes.text());
    }

    // Build report payload mirroring the webhook contract
    // Ahrefs v3 returns metrics with these keys: domain_rating, ahrefs_rank, org_traffic, org_keywords, backlinks, refdomains, org_cost
    const snapshot = {
      dr: m.domain_rating,
      org_traffic: m.org_traffic ?? m.organic_traffic,
      org_keywords_total: m.org_keywords ?? m.organic_keywords,
      backlinks_live: m.backlinks,
      referring_domains: m.refdomains ?? m.referring_domains,
    };

    const reportPayload = {
      tenant_id: client.tenant_id,
      client_id: client.id,
      agency_id: client.agency_id,
      domain,
      report_type: "site_explorer",
      report_date: reportDate,
      report_data: {
        domain,
        snapshot,
        organic_keywords,
      },
      metadata: { source: "fetch-ahrefs-snapshot", triggered_by: user.id },
    };

    // POST to ahrefs-webhook so all auto-create + crm_records sync logic runs
    const webhookUrl = `${supabaseUrl}/functions/v1/ahrefs-webhook`;
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
      body: JSON.stringify(reportPayload),
    });
    const webhookJson = await webhookRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        domain,
        keywords_count: organic_keywords.length,
        snapshot,
        webhook: webhookJson,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in fetch-ahrefs-snapshot:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
