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
    
    console.log('Syncing Google Analytics data for table:', tableId);
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
    if (!settings?.integration_id || !settings?.property_id) {
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

    // Format property ID (remove 'properties/' prefix if present)
    const propertyId = settings.property_id.replace('properties/', '');

    // Fetch Google Analytics data using Data API
    const reportRequest = {
      dateRanges: [
        {
          startDate: startDate,
          endDate: endDate,
        },
      ],
      dimensions: [
        { name: 'date' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViewsPerSession' },
      ],
    };

    const reportResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportRequest),
      }
    );

    const reportData = await reportResponse.json();
    console.log('GA4 report response:', JSON.stringify(reportData).substring(0, 500));

    if (reportData.error) {
      throw new Error(reportData.error.message);
    }

    // Delete existing records for this table
    await supabase
      .from('crm_records')
      .delete()
      .eq('table_id', tableId);

    // Ensure fields exist
    const fieldDefinitions = [
      { key: 'date', name: 'תאריך', type: 'date', position: 0 },
      { key: 'sessions', name: 'Sessions', type: 'number', position: 1 },
      { key: 'users', name: 'Users', type: 'number', position: 2 },
      { key: 'new_users', name: 'New Users', type: 'number', position: 3 },
      { key: 'pageviews', name: 'Pageviews', type: 'number', position: 4 },
      { key: 'bounce_rate', name: 'Bounce Rate (%)', type: 'number', position: 5 },
      { key: 'avg_session_duration', name: 'Avg Duration (sec)', type: 'number', position: 6 },
      { key: 'pages_per_session', name: 'Pages/Session', type: 'number', position: 7 },
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
    
    if (reportData.rows) {
      for (const row of reportData.rows) {
        const date = row.dimensionValues[0].value;
        const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
        
        records.push({
          table_id: tableId,
          tenant_id: table.tenant_id,
          agency_id: table.agency_id,
          data: {
            date: formattedDate,
            sessions: parseInt(row.metricValues[0].value) || 0,
            users: parseInt(row.metricValues[1].value) || 0,
            new_users: parseInt(row.metricValues[2].value) || 0,
            pageviews: parseInt(row.metricValues[3].value) || 0,
            bounce_rate: parseFloat(row.metricValues[4].value).toFixed(2) || 0,
            avg_session_duration: parseFloat(row.metricValues[5].value).toFixed(1) || 0,
            pages_per_session: parseFloat(row.metricValues[6].value).toFixed(2) || 0,
          },
        });
      }
    }

    // Insert records
    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from('crm_records')
        .insert(records);

      if (insertError) {
        console.error('Error inserting records:', insertError);
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
