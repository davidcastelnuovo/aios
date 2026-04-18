// Cron job to refresh Ahrefs base snapshots (overview + organic keywords)
// for every SEO client with a configured Ahrefs report.
// IMPORTANT: per project memory `ahrefs-manual-comparison-sync`, historical
// 3M/12M comparison data is NOT fetched here — only the base snapshot — to
// preserve API credits. Comparisons remain manual via fetch-ahrefs-snapshot.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const normalizeDomain = (s: string | null | undefined) =>
  (s || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const ahrefsApiKey = Deno.env.get('AHREFS_API_KEY');
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!ahrefsApiKey) {
      return new Response(JSON.stringify({ error: 'AHREFS_API_KEY not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find every SEO crm_table that has an associated client + domain
    const { data: tables, error } = await supabase
      .from('crm_tables')
      .select('id, name, tenant_id, integration_settings')
      .eq('integration_type', 'ahrefs');

    if (error) throw error;
    console.log(`[cron-sync-ahrefs] Found ${tables?.length || 0} ahrefs tables`);

    const results: any[] = [];

    for (const table of tables || []) {
      try {
        const settings = (table.integration_settings || {}) as any;
        const clientId: string | undefined = settings?.client_id || settings?.clientId;
        let domain: string | undefined = normalizeDomain(settings?.domain);
        const country: string = settings?.country || 'il';

        if (!clientId) {
          results.push({ table_id: table.id, name: table.name, ok: false, error: 'no client_id' });
          continue;
        }

        // Fall back to client.website if domain not stored on the table
        let client: any = null;
        const { data: c } = await supabase
          .from('clients')
          .select('id, name, website, agency_id, tenant_id')
          .eq('id', clientId)
          .maybeSingle();
        client = c;

        if (!client) {
          results.push({ table_id: table.id, name: table.name, ok: false, error: 'client not found' });
          continue;
        }

        if (!domain) domain = normalizeDomain(client.website);
        if (!domain) {
          results.push({ table_id: table.id, name: table.name, ok: false, error: 'no domain' });
          continue;
        }

        // Try multiple modes/dates to find a snapshot
        const today = new Date().toISOString().split('T')[0];
        const tryDates: string[] = [today];
        for (let i = 1; i <= 14; i++) {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - i);
          tryDates.push(d.toISOString().split('T')[0]);
        }
        const baseModes: Array<{ mode: string; protocol: string }> = [
          { mode: 'subdomains', protocol: 'both' },
          { mode: 'exact', protocol: 'both' },
          { mode: 'domain', protocol: 'both' },
        ];
        const hintMode = settings?.mode;
        const hintProtocol = settings?.protocol;
        const tryModes = hintMode || hintProtocol
          ? [
              { mode: hintMode || 'subdomains', protocol: hintProtocol || 'both' },
              ...baseModes.filter(m => !(m.mode === (hintMode || 'subdomains') && m.protocol === (hintProtocol || 'both'))),
            ]
          : baseModes;

        let overviewJson: any = null;
        let usedDate = '';
        let usedMode = 'subdomains';
        let usedProtocol = 'both';

        outer: for (const { mode, protocol } of tryModes) {
          for (const d of tryDates) {
            const url = `https://api.ahrefs.com/v3/site-explorer/metrics?target=${encodeURIComponent(domain)}&date=${d}&protocol=${protocol}&mode=${mode}&output=json&volume_mode=monthly`;
            const r = await fetch(url, {
              headers: { Authorization: `Bearer ${ahrefsApiKey}`, Accept: 'application/json' },
            });
            if (r.ok) {
              overviewJson = await r.json();
              usedDate = d;
              usedMode = mode;
              usedProtocol = protocol;
              break outer;
            }
            if (r.status === 401 || r.status === 403) break outer;
          }
        }

        if (!overviewJson || !usedDate) {
          results.push({ table_id: table.id, name: table.name, ok: false, error: 'no snapshot available' });
          continue;
        }

        const m = overviewJson?.metrics || overviewJson || {};
        const snapshot = {
          dr: m.domain_rating,
          org_traffic: m.org_traffic ?? m.organic_traffic,
          org_keywords_total: m.org_keywords ?? m.organic_keywords,
          backlinks_live: m.backlinks,
          referring_domains: m.refdomains ?? m.referring_domains,
        };

        // Organic keywords (top 500)
        const kwUrl = `https://api.ahrefs.com/v3/site-explorer/organic-keywords?target=${encodeURIComponent(domain)}&date=${usedDate}&country=${country}&protocol=${usedProtocol}&mode=${usedMode}&output=json&limit=500&select=keyword,volume,keyword_difficulty,cpc,traffic,position,url`;
        const kwRes = await fetch(kwUrl, {
          headers: { Authorization: `Bearer ${ahrefsApiKey}`, Accept: 'application/json' },
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
        }

        // Post to ahrefs-webhook (no comparison_data — kept manual per memory)
        const reportPayload = {
          tenant_id: client.tenant_id,
          client_id: client.id,
          agency_id: client.agency_id,
          domain,
          report_type: 'site_explorer',
          report_date: usedDate,
          report_data: { domain, snapshot, organic_keywords },
          metadata: {
            source: 'cron-sync-ahrefs',
            used_mode: usedMode,
            used_protocol: usedProtocol,
          },
        };

        const webhookRes = await fetch(`${supabaseUrl}/functions/v1/ahrefs-webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify(reportPayload),
        });

        results.push({
          table_id: table.id,
          name: table.name,
          ok: webhookRes.ok,
          domain,
          keywords: organic_keywords.length,
        });

        // Throttle to spare Ahrefs API credits
        await new Promise(r => setTimeout(r, 3000));
      } catch (e: any) {
        console.error(`[cron-ahrefs] failed for ${table.id}:`, e.message);
        results.push({ table_id: table.id, name: table.name, ok: false, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, total: tables?.length || 0, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('cron-sync-ahrefs error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
