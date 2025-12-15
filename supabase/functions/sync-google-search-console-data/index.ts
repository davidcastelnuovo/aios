import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tableId, startDate, endDate } = await req.json();
    
    console.log('Syncing Google Search Console data for table:', tableId);
    console.log('Date range:', startDate, 'to', endDate);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get table with integration settings
    const { data: table, error: tableError } = await supabase
      .from('crm_tables')
      .select('*')
      .eq('id', tableId)
      .single();

    if (tableError || !table) {
      throw new Error('Table not found');
    }

    const settings = table.integration_settings as any;
    if (!settings?.integration_id || !settings?.site_url) {
      throw new Error('Missing integration settings');
    }

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('id', settings.integration_id)
      .single();

    if (integrationError || !integration) {
      throw new Error('Integration not found');
    }

    let accessToken = integration.api_key;
    const integrationSettings = integration.settings as any;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    // Refresh token if needed
    if (integrationSettings?.expires_at && new Date(integrationSettings.expires_at) < new Date()) {
      console.log('Refreshing expired token...');
      
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: integrationSettings.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();
      
      if (refreshData.access_token) {
        accessToken = refreshData.access_token;
        const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();
        
        await supabase
          .from('tenant_integrations')
          .update({
            api_key: accessToken,
            settings: { ...integrationSettings, expires_at: newExpiresAt },
          })
          .eq('id', integration.id);
      }
    }

    // Fetch Search Console data - Query Performance
    const searchRequest = {
      startDate: startDate,
      endDate: endDate,
      dimensions: ['date', 'query', 'page'],
      rowLimit: 25000,
    };

    const searchResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(settings.site_url)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchRequest),
      }
    );

    const searchData = await searchResponse.json();
    console.log('Search Console response:', JSON.stringify(searchData).substring(0, 500));

    if (searchData.error) {
      throw new Error(searchData.error.message);
    }

    // Delete existing records for this table
    await supabase
      .from('crm_records')
      .delete()
      .eq('table_id', tableId);

    // Ensure fields exist
    const fieldDefinitions = [
      { key: 'date', name: 'תאריך', type: 'date', position: 0 },
      { key: 'query', name: 'מילת חיפוש', type: 'text', position: 1 },
      { key: 'page', name: 'עמוד', type: 'url', position: 2 },
      { key: 'clicks', name: 'קליקים', type: 'number', position: 3 },
      { key: 'impressions', name: 'חשיפות', type: 'number', position: 4 },
      { key: 'ctr', name: 'CTR (%)', type: 'number', position: 5 },
      { key: 'position', name: 'מיקום ממוצע', type: 'number', position: 6 },
    ];

    for (const field of fieldDefinitions) {
      await supabase
        .from('crm_fields')
        .upsert({
          table_id: tableId,
          key: field.key,
          name: field.name,
          type: field.type,
          position: field.position,
          is_visible: true,
          is_required: false,
          config: {},
        }, { onConflict: 'table_id,key' });
    }

    // Process and insert data
    const records: any[] = [];
    
    if (searchData.rows) {
      for (const row of searchData.rows) {
        records.push({
          table_id: tableId,
          tenant_id: table.tenant_id,
          agency_id: table.agency_id,
          data: {
            date: row.keys[0],
            query: row.keys[1],
            page: row.keys[2],
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: (row.ctr * 100).toFixed(2),
            position: row.position?.toFixed(1) || 0,
          },
        });
      }
    }

    // Insert records in batches
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('crm_records')
        .insert(batch);

      if (insertError) {
        console.error('Error inserting batch:', insertError);
        throw insertError;
      }
    }

    // Update last sync timestamp
    await supabase
      .from('crm_tables')
      .update({
        integration_settings: {
          ...settings,
          last_sync_at: new Date().toISOString(),
        },
      })
      .eq('id', tableId);

    console.log(`Successfully synced ${records.length} records`);

    return new Response(
      JSON.stringify({ success: true, records_synced: records.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
