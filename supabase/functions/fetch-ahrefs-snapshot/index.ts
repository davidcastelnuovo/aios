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
    const {
      clientId,
      domain: rawDomain,
      country = "il",
      mode: hintMode,
      protocol: hintProtocol,
      projectId,
    } = body as {
      clientId?: string;
      domain?: string;
      country?: string;
      mode?: string;
      protocol?: string;
      projectId?: string | number;
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

    // If the project picker passed mode/protocol from Ahrefs, try them first.
    const baseModes: Array<{ mode: string; protocol: string }> = [
      { mode: "subdomains", protocol: "both" },
      { mode: "exact", protocol: "both" },
      { mode: "domain", protocol: "both" },
      { mode: "subdomains", protocol: "https" },
      { mode: "exact", protocol: "https" },
      { mode: "domain", protocol: "https" },
    ];
    const tryModes: Array<{ mode: string; protocol: string }> =
      hintMode || hintProtocol
        ? [
            { mode: hintMode || "subdomains", protocol: hintProtocol || "both" },
            ...baseModes.filter(
              (m) => !(m.mode === (hintMode || "subdomains") && m.protocol === (hintProtocol || "both"))
            ),
          ]
        : baseModes;

    // 1) Domain overview (snapshot) — try mode/protocol combos, then dates
    let overviewJson: any = null;
    let usedDate: string | null = null;
    let usedMode = "subdomains";
    let usedProtocol = "both";
    let lastErr = "";
    let lastStatus = 0;

    const METRICS_SELECT = "domain_rating,org_traffic,org_keywords,backlinks,refdomains";

    outer: for (const { mode, protocol } of tryModes) {
      for (const d of tryDates) {
        const overviewUrl = `https://api.ahrefs.com/v3/site-explorer/metrics?target=${encodeURIComponent(domain)}&date=${d}&protocol=${protocol}&mode=${mode}&output=json&volume_mode=monthly&select=${METRICS_SELECT}`;
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
    // Compute Top 3 / Top 10 keyword counts from the organic keywords list (up to limit=500)
    const top3Count = organic_keywords.filter((k: any) => typeof k.position === "number" && k.position >= 1 && k.position <= 3).length;
    const top10Count = organic_keywords.filter((k: any) => typeof k.position === "number" && k.position >= 1 && k.position <= 10).length;

    const snapshot = {
      dr: m.domain_rating,
      org_traffic: m.org_traffic ?? m.organic_traffic,
      org_keywords_total: m.org_keywords ?? m.organic_keywords,
      org_keywords_top3: top3Count,
      org_keywords_top10: top10Count,
      backlinks_live: m.backlinks,
      referring_domains: m.refdomains ?? m.referring_domains,
    };

    // 3) Historical comparisons — pull metrics for ~3 months ago and ~12 months ago.
    const fetchHistoricalMetrics = async (anchor: Date) => {
      for (let i = 0; i <= 14; i++) {
        const d = new Date(anchor);
        d.setUTCDate(d.getUTCDate() - i);
        const ds = d.toISOString().split("T")[0];
        const url = `https://api.ahrefs.com/v3/site-explorer/metrics?target=${encodeURIComponent(domain)}&date=${ds}&protocol=${usedProtocol}&mode=${usedMode}&output=json&volume_mode=monthly&select=${METRICS_SELECT}`;
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${ahrefsApiKey}`, Accept: "application/json" },
        });
        if (r.ok) {
          const j = await r.json();
          const mm = j?.metrics || j || {};
          return {
            date: ds,
            dr: mm.domain_rating,
            org_traffic: mm.org_traffic ?? mm.organic_traffic,
            org_keywords_total: mm.org_keywords ?? mm.organic_keywords,
            backlinks_live: mm.backlinks,
            referring_domains: mm.refdomains ?? mm.referring_domains,
          };
        }
      }
      return null;
    };

    const anchor3m = new Date(reportDate);
    anchor3m.setUTCMonth(anchor3m.getUTCMonth() - 3);
    const anchor12m = new Date(reportDate);
    anchor12m.setUTCFullYear(anchor12m.getUTCFullYear() - 1);

    const [snap3m, snap12m] = await Promise.all([
      fetchHistoricalMetrics(anchor3m),
      fetchHistoricalMetrics(anchor12m),
    ]);

    const comparison_data = {
      "3_months": snap3m,
      "12_months": snap12m,
    };

    // 4) Tracked (Rank Tracker) keywords — only if a project_id was passed from the picker.
    // These endpoints are FREE and do not consume API units.
    let tracked_keywords: any[] = [];
    let trackedSource: string | null = null;
    if (projectId) {
      try {
        const trackedByKey = new Map<string, any>();
        const normalizeTracked = (k: any, source: string, device?: string) => ({
          keyword: String(k.keyword || "").trim(),
          position: k.position ?? null,
          position_prev_month: k.position_prev ?? null,
          traffic: k.traffic ?? 0,
          traffic_prev_month: k.traffic_prev ?? 0,
          volume: k.volume ?? 0,
          kd: k.keyword_difficulty ?? null,
          cpc: k.cost_per_click ?? null,
          url: k.url ?? "",
          country: k.country ?? null,
          location: k.location ?? null,
          language: k.language ?? k.language_code ?? null,
          tags: Array.isArray(k.tags) ? k.tags : [],
          _source: source,
          _device: device ?? null,
        });

        const addTrackedRows = (rows: any[], source: string, device?: string) => {
          for (const row of rows) {
            if (!row || typeof row.keyword !== "string" || !row.keyword.trim()) continue;
            const normalized = normalizeTracked(row, source, device);
            const key = [normalized.keyword.toLowerCase(), normalized.country, normalized.location, normalized.language].join("|");
            if (!trackedByKey.has(key)) trackedByKey.set(key, normalized);
          }
        };

        const selectFields = [
          "keyword",
          "position",
          "position_prev",
          "volume",
          "keyword_difficulty",
          "cost_per_click",
          "traffic",
          "traffic_prev",
          "url",
          "country",
          "location",
          "language",
          "tags",
        ].join(",");

        const trackerDates: string[] = [];
        const reportDateObj = new Date(`${reportDate}T00:00:00Z`);
        for (let i = 0; i <= 14; i++) {
          const d = new Date(reportDateObj);
          d.setUTCDate(d.getUTCDate() - i);
          trackerDates.push(d.toISOString().split("T")[0]);
        }

        for (const trackerDate of trackerDates) {
          const compared = new Date(`${trackerDate}T00:00:00Z`);
          compared.setUTCDate(compared.getUTCDate() - 30);
          const comparedDate = compared.toISOString().split("T")[0];

          for (const device of ["desktop", "mobile"]) {
            const trackerUrl =
              `https://api.ahrefs.com/v3/rank-tracker/overview` +
              `?project_id=${encodeURIComponent(String(projectId))}` +
              `&device=${device}` +
              `&date=${trackerDate}` +
              `&date_compared=${comparedDate}` +
              `&select=${encodeURIComponent(selectFields)}` +
              `&limit=1000` +
              `&volume_mode=monthly` +
              `&output=json`;
            const trackerRes = await fetch(trackerUrl, {
              headers: { Authorization: `Bearer ${ahrefsApiKey}`, Accept: "application/json" },
            });
            if (trackerRes.ok) {
              const trackerJson = await trackerRes.json();
              const overviews = Array.isArray(trackerJson?.overviews) ? trackerJson.overviews : [];
              addTrackedRows(overviews, "rank-tracker-overview", device);
              console.log(`Ahrefs Rank Tracker overview: project=${projectId} date=${trackerDate} device=${device} rows=${overviews.length}`);
            } else {
              const errTxt = await trackerRes.text();
              console.warn(`Ahrefs Rank Tracker overview failed: project=${projectId} date=${trackerDate} device=${device} status=${trackerRes.status} body=${errTxt.slice(0, 200)}`);
            }
          }

          if (trackedByKey.size > 0) break;
        }

        if (trackedByKey.size === 0) {
          const projectKeywordsUrl =
            `https://api.ahrefs.com/v3/management/project-keywords` +
            `?project_id=${encodeURIComponent(String(projectId))}` +
            `&output=json`;
          const projectKeywordsRes = await fetch(projectKeywordsUrl, {
            headers: { Authorization: `Bearer ${ahrefsApiKey}`, Accept: "application/json" },
          });
          if (projectKeywordsRes.ok) {
            const projectKeywordsJson = await projectKeywordsRes.json();
            const projectKeywords = Array.isArray(projectKeywordsJson?.keywords) ? projectKeywordsJson.keywords : [];
            addTrackedRows(projectKeywords, "management-project-keywords");
            console.log(`Ahrefs Project Keywords fallback: project=${projectId} rows=${projectKeywords.length}`);
          } else {
            const errTxt = await projectKeywordsRes.text();
            console.warn(`Ahrefs Project Keywords fallback failed: project=${projectId} status=${projectKeywordsRes.status} body=${errTxt.slice(0, 200)}`);
          }
        }

        tracked_keywords = Array.from(trackedByKey.values());
        trackedSource = tracked_keywords[0]?._source ?? null;
        console.log(`Ahrefs tracked keywords resolved: project=${projectId} tracked_count=${tracked_keywords.length} source=${trackedSource ?? "none"}`);
      } catch (e) {
        console.warn("Rank Tracker fetch threw:", e instanceof Error ? e.message : String(e));
      }
    }

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
        tracked_keywords,
      },
      comparison_data,
      metadata: {
        source: "fetch-ahrefs-snapshot",
        triggered_by: user.id,
        used_mode: usedMode,
        used_protocol: usedProtocol,
        ahrefs_project_id: projectId ?? null,
        tracked_source: trackedSource,
      },
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
        tracked_count: tracked_keywords.length,
        tracked_source: trackedSource,
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
