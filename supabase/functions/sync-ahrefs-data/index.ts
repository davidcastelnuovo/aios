import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AhrefsConfig {
  target?: string; // Domain to analyze
  dataType: 'site_explorer' | 'backlinks' | 'organic_traffic' | 'referring_domains';
  country?: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ahrefsApiKey = Deno.env.get('AHREFS_API_KEY');

    if (!ahrefsApiKey) {
      return new Response(
        JSON.stringify({ error: 'Ahrefs API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: activeTenant } = await supabase
      .from('user_active_tenant')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    const tenantId = activeTenant?.tenant_id;
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'No active tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { tableId, config } = body as { tableId: string; config: AhrefsConfig };

    if (!tableId || !config || !config.target) {
      return new Response(
        JSON.stringify({ error: 'Missing tableId or config.target (domain required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizeTarget = (raw: string) => {
      // Accept domain or full URL; send only hostname/domain to Ahrefs
      try {
        if (raw.startsWith('http://') || raw.startsWith('https://')) {
          return new URL(raw).hostname;
        }
      } catch {
        // ignore
      }
      return raw.replace(/^https?:\/\//, '').split('/')[0];
    };

    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const target = normalizeTarget(config.target);

    console.log(`Syncing Ahrefs data for table ${tableId}, type: ${config.dataType}, target: ${target}, date: ${date}`);

    let apiUrl = '';
    let selectFields: string[] = [];

    // Build API request based on data type (Site Explorer endpoints - available on standard plans)
    switch (config.dataType) {
      case 'organic_traffic':
        // Organic Keywords report (requires date)
        apiUrl = `https://api.ahrefs.com/v3/site-explorer/organic-keywords?target=${encodeURIComponent(target)}&date=${encodeURIComponent(date)}&country=${config.country || 'il'}&limit=${config.limit || 1000}&select=keyword,volume,keyword_difficulty,cpc,traffic,traffic_percentage,position,url,serp_features`;
        selectFields = ['keyword', 'volume', 'keyword_difficulty', 'cpc', 'traffic', 'traffic_percentage', 'position', 'url', 'serp_features'];
        break;
      
      case 'backlinks':
        // Backlinks report (requires date)
        apiUrl = `https://api.ahrefs.com/v3/site-explorer/backlinks?target=${encodeURIComponent(target)}&date=${encodeURIComponent(date)}&limit=${config.limit || 1000}&select=url_from,url_to,anchor,domain_rating_source,url_rating_source,traffic,first_seen,last_seen,nofollow,is_dofollow`;
        selectFields = ['url_from', 'url_to', 'anchor', 'domain_rating_source', 'url_rating_source', 'traffic', 'first_seen', 'last_seen', 'nofollow', 'is_dofollow'];
        break;
      
      case 'referring_domains':
        // Referring Domains report (requires date)
        apiUrl = `https://api.ahrefs.com/v3/site-explorer/refdomains?target=${encodeURIComponent(target)}&date=${encodeURIComponent(date)}&limit=${config.limit || 1000}&select=domain,domain_rating,backlinks,first_seen,last_seen,linked_domains`;
        selectFields = ['domain', 'domain_rating', 'backlinks', 'first_seen', 'last_seen', 'linked_domains'];
        break;
      
      case 'site_explorer':
      default:
        // Domain overview (default) (requires date)
        apiUrl = `https://api.ahrefs.com/v3/site-explorer/overview?target=${encodeURIComponent(target)}&date=${encodeURIComponent(date)}&select=domain_rating,ahrefs_rank,organic_traffic,organic_keywords,backlinks,referring_domains,organic_value`;
        selectFields = ['domain_rating', 'ahrefs_rank', 'organic_traffic', 'organic_keywords', 'backlinks', 'referring_domains', 'organic_value'];
        break;
    }

    console.log(`Fetching from Ahrefs API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${ahrefsApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ahrefs API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Ahrefs API error', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiData = await response.json();
    console.log('Ahrefs API response keys:', Object.keys(apiData));

    // Determine the data array from response
    let records: any[] = [];
    if (apiData.keywords) {
      records = apiData.keywords;
    } else if (apiData.backlinks) {
      records = apiData.backlinks;
    } else if (apiData.refdomains) {
      records = apiData.refdomains;
    } else if (apiData.metrics) {
      // Single overview response
      records = [apiData.metrics];
    } else {
      records = [apiData];
    }
    
    console.log(`Received ${records.length} records`);

    // Ensure fields exist for this table
    const { data: existingFields } = await supabase
      .from('crm_fields')
      .select('key')
      .eq('table_id', tableId);

    const existingKeys = new Set(existingFields?.map(f => f.key) || []);
    
    // Field labels in Hebrew
    const fieldLabels: Record<string, string> = {
      keyword: 'מילת מפתח',
      volume: 'נפח חיפוש',
      keyword_difficulty: 'קושי',
      cpc: 'מחיר לקליק',
      traffic: 'תנועה',
      traffic_percentage: 'אחוז תנועה',
      position: 'מיקום',
      position_diff: 'שינוי מיקום',
      traffic_diff: 'שינוי תנועה',
      serp_updated: 'עדכון אחרון',
      url: 'כתובת',
      url_from: 'קישור מ-',
      url_to: 'קישור ל-',
      anchor: 'אנקור',
      domain_rating_source: 'DR מקור',
      url_rating_source: 'UR מקור',
      first_seen: 'נראה לראשונה',
      last_seen: 'נראה לאחרונה',
      nofollow: 'Nofollow',
      is_dofollow: 'Dofollow',
      domain_rating: 'Domain Rating',
      ahrefs_rank: 'Ahrefs Rank',
      organic_traffic: 'תנועה אורגנית',
      organic_keywords: 'מילות מפתח אורגניות',
      backlinks: 'בקלינקים',
      referring_domains: 'דומיינים מפנים',
      organic_value: 'ערך אורגני',
      clicks: 'קליקים',
      clicks_percentage: 'אחוז קליקים',
      global_volume: 'נפח גלובלי',
      cpc_usd: 'CPC (דולר)',
      serp_features: 'SERP Features',
    };

    const fieldTypes: Record<string, string> = {
      keyword: 'text',
      volume: 'number',
      keyword_difficulty: 'number',
      cpc: 'number',
      traffic: 'number',
      traffic_percentage: 'number',
      position: 'number',
      position_diff: 'number',
      traffic_diff: 'number',
      serp_updated: 'date',
      url: 'url',
      url_from: 'url',
      url_to: 'url',
      anchor: 'text',
      domain_rating_source: 'number',
      url_rating_source: 'number',
      first_seen: 'date',
      last_seen: 'date',
      nofollow: 'checkbox',
      is_dofollow: 'checkbox',
      domain_rating: 'number',
      ahrefs_rank: 'number',
      organic_traffic: 'number',
      organic_keywords: 'number',
      backlinks: 'number',
      referring_domains: 'number',
      organic_value: 'number',
      clicks: 'number',
      clicks_percentage: 'number',
      global_volume: 'number',
      cpc_usd: 'number',
      serp_features: 'text',
    };

    // Create missing fields
    const newFields = selectFields.filter(f => !existingKeys.has(f));
    if (newFields.length > 0) {
      const fieldsToInsert = newFields.map((key, index) => ({
        table_id: tableId,
        key,
        name: fieldLabels[key] || key,
        type: fieldTypes[key] || 'text',
        position: existingKeys.size + index,
        is_required: false,
        is_visible: true,
        config: {},
      }));

      await supabase.from('crm_fields').insert(fieldsToInsert);
    }

    // Delete existing records
    await supabase.from('crm_records').delete().eq('table_id', tableId);

    // Insert new records
    const recordsToInsert = records.map(record => ({
      table_id: tableId,
      tenant_id: tenantId,
      data: record,
    }));

    if (recordsToInsert.length > 0) {
      // Insert in batches of 500
      const batchSize = 500;
      for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from('crm_records').insert(batch);
        if (insertError) {
          console.error('Error inserting records:', insertError);
        }
      }
    }

    // Update table sync timestamp
    await supabase
      .from('crm_tables')
      .update({ 
        last_sync_at: new Date().toISOString(),
        integration_settings: {
          ...config,
          last_sync_at: new Date().toISOString(),
        }
      })
      .eq('id', tableId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recordsCount: records.length,
        message: `Synced ${records.length} records from Ahrefs`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-ahrefs-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
