import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AhrefsConfig {
  target?: string; // Domain to analyze
  projectId?: string; // Rank Tracker project ID
  device?: 'desktop' | 'mobile'; // Rank Tracker device
  dataType: 'site_explorer' | 'keywords' | 'backlinks' | 'organic_traffic' | 'rank_tracker';
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

    if (!tableId || !config || (!config.target && !config.projectId)) {
      return new Response(
        JSON.stringify({ error: 'Missing tableId or config (target or projectId required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing Ahrefs data for table ${tableId}, type: ${config.dataType}, target: ${config.target || config.projectId}`);

    let apiUrl = '';
    let selectFields: string[] = [];

    // Build API request based on data type
    switch (config.dataType) {
      case 'organic_traffic':
        // Organic Keywords report
        apiUrl = `https://api.ahrefs.com/v3/site-explorer/organic-keywords?target=${encodeURIComponent(config.target || '')}&country=${config.country || 'il'}&limit=${config.limit || 1000}&select=keyword,volume,keyword_difficulty,cpc,traffic,traffic_percentage,position,url,serp_features`;
        selectFields = ['keyword', 'volume', 'keyword_difficulty', 'cpc', 'traffic', 'traffic_percentage', 'position', 'url', 'serp_features'];
        break;
      
      case 'backlinks':
        // Backlinks report
        apiUrl = `https://api.ahrefs.com/v3/site-explorer/backlinks?target=${encodeURIComponent(config.target || '')}&limit=${config.limit || 1000}&select=url_from,url_to,anchor,domain_rating_source,url_rating_source,traffic,first_seen,last_seen,nofollow,is_dofollow`;
        selectFields = ['url_from', 'url_to', 'anchor', 'domain_rating_source', 'url_rating_source', 'traffic', 'first_seen', 'last_seen', 'nofollow', 'is_dofollow'];
        break;
      
      case 'site_explorer':
        // Domain overview
        apiUrl = `https://api.ahrefs.com/v3/site-explorer/overview?target=${encodeURIComponent(config.target || '')}&select=domain_rating,ahrefs_rank,organic_traffic,organic_keywords,backlinks,referring_domains,organic_value`;
        selectFields = ['domain_rating', 'ahrefs_rank', 'organic_traffic', 'organic_keywords', 'backlinks', 'referring_domains', 'organic_value'];
        break;
      
      case 'keywords':
        // Keywords Explorer - single keyword or list
        apiUrl = `https://api.ahrefs.com/v3/keywords-explorer/overview?country=${config.country || 'il'}&keywords=${encodeURIComponent(config.target || '')}&select=keyword,volume,keyword_difficulty,cpc,clicks,clicks_percentage,global_volume,cpc_usd`;
        selectFields = ['keyword', 'volume', 'keyword_difficulty', 'cpc', 'clicks', 'clicks_percentage', 'global_volume', 'cpc_usd'];
        break;
      
      case 'rank_tracker':
        // Rank Tracker - requires project ID
        if (!config.projectId) {
          return new Response(
            JSON.stringify({ error: 'Rank Tracker requires a projectId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // date parameter is required - use today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        apiUrl = `https://api.ahrefs.com/v3/rank-tracker/overview?project_id=${encodeURIComponent(config.projectId)}&device=${encodeURIComponent(config.device || 'desktop')}&date=${today}&select=keyword,volume,position,position_diff,traffic,traffic_diff,url,keyword_difficulty,serp_features,serp_updated`;
        selectFields = ['keyword', 'volume', 'position', 'position_diff', 'traffic', 'traffic_diff', 'url', 'keyword_difficulty', 'serp_features', 'serp_updated'];
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported data type: ${config.dataType}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
    if (apiData.overviews) {
      // Rank Tracker response
      records = apiData.overviews;
    } else if (apiData.keywords) {
      records = apiData.keywords;
    } else if (apiData.backlinks) {
      records = apiData.backlinks;
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
