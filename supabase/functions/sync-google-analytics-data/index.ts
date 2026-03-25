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
    // Support both integrationId and integration_id
    const integrationId = settings?.integrationId || settings?.integration_id;
    const propertyIdRaw = settings?.propertyId || settings?.property_id;
    
    if (!integrationId || !propertyIdRaw) {
      throw new Error('Missing integration settings: integrationId=' + integrationId + ', propertyId=' + propertyIdRaw);
    }

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('id', integrationId)
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
    const propertyId = propertyIdRaw.replace('properties/', '');

    // Calculate date range
    const now = new Date();
    const actualEndDate = endDate || now.toISOString().split('T')[0];
    const actualStartDate = startDate || new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

    // ====== REPORT 1: Traffic by Source/Medium (main metrics) ======
    const trafficSourceRequest = {
      dateRanges: [{ startDate: actualStartDate, endDate: actualEndDate }],
      dimensions: [
        { name: 'sessionSourceMedium' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' },
        { name: 'addToCarts' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 50,
    };

    const trafficResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trafficSourceRequest),
      }
    );

    const trafficData = await trafficResponse.json();
    console.log('GA4 traffic source response:', JSON.stringify(trafficData).substring(0, 500));

    if (trafficData.error) {
      throw new Error(trafficData.error.message);
    }

    // ====== REPORT 2: Daily trends ======
    const dailyRequest = {
      dateRanges: [{ startDate: actualStartDate, endDate: actualEndDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'conversions' },
        { name: 'addToCarts' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    };

    const dailyResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dailyRequest),
      }
    );

    const dailyData = await dailyResponse.json();

    // ====== REPORT 3: Daily source/medium breakdown (for date-synced source charts) ======
    const dailySourceRequest = {
      dateRanges: [{ startDate: actualStartDate, endDate: actualEndDate }],
      dimensions: [
        { name: 'date' },
        { name: 'sessionSourceMedium' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' },
        { name: 'addToCarts' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
      ],
      orderBys: [
        { dimension: { dimensionName: 'date' }, desc: false },
        { metric: { metricName: 'sessions' }, desc: true },
      ],
      limit: 10000,
    };

    const dailySourceResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dailySourceRequest),
      }
    );

    const dailySourceData = await dailySourceResponse.json();

    // ====== REPORT 4: Top pages ======
    const pagesRequest = {
      dateRanges: [{ startDate: actualStartDate, endDate: actualEndDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' },
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 20,
    };

    const pagesResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pagesRequest),
      }
    );

    const pagesData = await pagesResponse.json();

    if (dailyData.error) {
      throw new Error(dailyData.error.message);
    }

    if (dailySourceData.error) {
      throw new Error(dailySourceData.error.message);
    }

    if (pagesData.error) {
      throw new Error(pagesData.error.message);
    }

    // Delete existing records for this table
    await supabase
      .from('crm_records')
      .delete()
      .eq('table_id', tableId);

    // Ensure fields exist
    const fieldDefinitions = [
      { key: 'report_type', name: 'סוג דוח', type: 'text', position: 0 },
      { key: 'source_medium', name: 'מקור / ערוץ', type: 'text', position: 1 },
      { key: 'date', name: 'תאריך', type: 'date', position: 2 },
      { key: 'page_path', name: 'נתיב עמוד', type: 'text', position: 3 },
      { key: 'sessions', name: 'Sessions', type: 'number', position: 4 },
      { key: 'users', name: 'Users', type: 'number', position: 5 },
      { key: 'new_users', name: 'New Users', type: 'number', position: 6 },
      { key: 'pageviews', name: 'Pageviews', type: 'number', position: 7 },
      { key: 'bounce_rate', name: 'Bounce Rate (%)', type: 'number', position: 8 },
      { key: 'avg_session_duration', name: 'Avg Duration (sec)', type: 'number', position: 9 },
      { key: 'conversions', name: 'Conversions', type: 'number', position: 10 },
      { key: 'add_to_cart', name: 'Add To Cart', type: 'number', position: 11 },
      { key: 'purchases', name: 'Purchases', type: 'number', position: 12 },
      { key: 'purchase_value', name: 'Purchase Value', type: 'number', position: 13 },
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
    
    // Traffic sources
    if (trafficData.rows) {
      for (const row of trafficData.rows) {
        const sourceMedium = row.dimensionValues[0].value;
        
        records.push({
          table_id: tableId,
          tenant_id: table.tenant_id,
          agency_id: table.agency_id,
          data: {
            report_type: 'traffic_source',
            source_medium: sourceMedium,
            date: null,
            page_path: null,
            sessions: parseInt(row.metricValues[0].value) || 0,
            users: parseInt(row.metricValues[1].value) || 0,
            new_users: parseInt(row.metricValues[2].value) || 0,
            pageviews: parseInt(row.metricValues[3].value) || 0,
            bounce_rate: (parseFloat(row.metricValues[4].value) * 100).toFixed(1),
            avg_session_duration: parseFloat(row.metricValues[5].value).toFixed(1),
            conversions: parseInt(row.metricValues[6].value) || 0,
            add_to_cart: parseInt(row.metricValues[7]?.value) || 0,
            purchases: parseInt(row.metricValues[8]?.value) || 0,
            purchase_value: parseFloat(row.metricValues[9]?.value) || 0,
          },
        });
      }
    }

    // Daily data
    if (dailyData.rows) {
      for (const row of dailyData.rows) {
        const date = row.dimensionValues[0].value;
        const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
        
        records.push({
          table_id: tableId,
          tenant_id: table.tenant_id,
          agency_id: table.agency_id,
          data: {
            report_type: 'daily',
            source_medium: null,
            date: formattedDate,
            page_path: null,
            sessions: parseInt(row.metricValues[0].value) || 0,
            users: parseInt(row.metricValues[1].value) || 0,
            new_users: null,
            pageviews: parseInt(row.metricValues[2].value) || 0,
            bounce_rate: null,
            avg_session_duration: null,
            conversions: parseInt(row.metricValues[3].value) || 0,
            add_to_cart: parseInt(row.metricValues[4]?.value) || 0,
            purchases: parseInt(row.metricValues[5]?.value) || 0,
            purchase_value: parseFloat(row.metricValues[6]?.value) || 0,
          },
        });
      }
    }

    // Daily source breakdown (date + source)
    if (dailySourceData.rows) {
      for (const row of dailySourceData.rows) {
        const date = row.dimensionValues[0].value;
        const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
        const sourceMedium = row.dimensionValues[1]?.value ?? 'Unknown';

        records.push({
          table_id: tableId,
          tenant_id: table.tenant_id,
          agency_id: table.agency_id,
          data: {
            report_type: 'daily_source',
            source_medium: sourceMedium,
            date: formattedDate,
            page_path: null,
            sessions: parseInt(row.metricValues[0].value) || 0,
            users: parseInt(row.metricValues[1].value) || 0,
            new_users: parseInt(row.metricValues[2].value) || 0,
            pageviews: parseInt(row.metricValues[3].value) || 0,
            bounce_rate: (parseFloat(row.metricValues[4].value) * 100).toFixed(1),
            avg_session_duration: parseFloat(row.metricValues[5].value).toFixed(1),
            conversions: parseInt(row.metricValues[6].value) || 0,
            add_to_cart: parseInt(row.metricValues[7]?.value) || 0,
            purchases: parseInt(row.metricValues[8]?.value) || 0,
            purchase_value: parseFloat(row.metricValues[9]?.value) || 0,
          },
        });
      }
    }

    // Top pages
    if (pagesData.rows) {
      for (const row of pagesData.rows) {
        records.push({
          table_id: tableId,
          tenant_id: table.tenant_id,
          agency_id: table.agency_id,
          data: {
            report_type: 'top_pages',
            source_medium: null,
            date: null,
            page_path: row.dimensionValues[0].value,
            sessions: parseInt(row.metricValues[1].value) || 0,
            users: null,
            new_users: null,
            pageviews: parseInt(row.metricValues[0].value) || 0,
            bounce_rate: null,
            avg_session_duration: parseFloat(row.metricValues[2].value).toFixed(1),
            conversions: null,
            add_to_cart: null,
            purchases: null,
            purchase_value: null,
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
        last_sync_at: new Date().toISOString(),
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
