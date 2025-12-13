import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InsightRecord {
  date: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cpm: number;
  ctr: number;
  leads: number;
  cost_per_lead: number;
  spend: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🕐 Starting cron sync for Facebook Insights tables...');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all Facebook Insights tables
    const { data: tables, error: tablesError } = await supabase
      .from('crm_tables')
      .select('*')
      .eq('integration_type', 'facebook_insights');

    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      throw tablesError;
    }

    console.log(`📊 Found ${tables?.length || 0} Facebook Insights tables to sync`);

    const results = {
      total: tables?.length || 0,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const table of tables || []) {
      try {
        console.log(`\n📈 Syncing table: ${table.name} (ID: ${table.id})`);
        
        const settings = table.integration_settings || {};
        const adAccountId = settings.ad_account_id;
        const dateRange = settings.date_range || 'last_30_days';

        if (!adAccountId) {
          console.log(`⏭️ Skipping ${table.name} - no ad account configured`);
          continue;
        }

        // Get Facebook access token for this table's tenant
        let { data: integration } = await supabase
          .from('tenant_integrations')
          .select('api_key, shared_from_integration_id')
          .eq('tenant_id', table.tenant_id)
          .in('integration_type', ['facebook', 'facebook_lead_ads'])
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        // If shared integration, get source token
        if (integration?.shared_from_integration_id && !integration?.api_key) {
          const { data: sourceIntegration } = await supabase
            .from('tenant_integrations')
            .select('api_key')
            .eq('id', integration.shared_from_integration_id)
            .eq('is_active', true)
            .maybeSingle();
          
          if (sourceIntegration?.api_key) {
            integration = { ...integration, api_key: sourceIntegration.api_key };
          }
        }

        if (!integration?.api_key) {
          console.log(`⏭️ Skipping ${table.name} - no Facebook token`);
          continue;
        }

        const accessToken = integration.api_key;

        // Calculate date range
        const now = new Date();
        let since: Date;
        let until = new Date(now);
        
        switch (dateRange) {
          case 'today':
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'yesterday':
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            until = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            break;
          case 'this_week':
            const dayOfWeek = now.getDay();
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
            break;
          case 'last_7_days':
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
            break;
          case 'last_14_days':
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
            break;
          case 'this_month':
            since = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'last_30_days':
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
            break;
          case 'last_90_days':
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
            break;
          case 'last_180_days':
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 180);
            break;
          case 'last_365_days':
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365);
            break;
          default:
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        }

        const sinceStr = since.toISOString().split('T')[0];
        const untilStr = until.toISOString().split('T')[0];

        console.log(`📅 Fetching data from ${sinceStr} to ${untilStr}`);

        // Fetch insights from Facebook
        const insightsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,cpm,ctr,actions,cost_per_action_type,spend&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&limit=500&access_token=${accessToken}`;
        
        const response = await fetch(insightsUrl);
        const data = await response.json();

        if (data.error) {
          console.error(`❌ Facebook API error for ${table.name}:`, data.error.message);
          results.failed++;
          results.errors.push(`${table.name}: ${data.error.message}`);
          continue;
        }

        const insights: InsightRecord[] = (data.data || []).map((insight: any) => {
          const leadAction = insight.actions?.find((a: any) => a.action_type === 'lead' || a.action_type === 'leadgen_grouped');
          const leads = leadAction ? parseInt(leadAction.value) : 0;
          
          const cplAction = insight.cost_per_action_type?.find((a: any) => a.action_type === 'lead' || a.action_type === 'leadgen_grouped');
          const costPerLead = cplAction ? parseFloat(cplAction.value) : 0;

          return {
            date: insight.date_start,
            campaign_id: insight.campaign_id,
            campaign_name: insight.campaign_name,
            impressions: parseInt(insight.impressions) || 0,
            clicks: parseInt(insight.clicks) || 0,
            cpm: parseFloat(insight.cpm) || 0,
            ctr: parseFloat(insight.ctr) || 0,
            leads,
            cost_per_lead: costPerLead,
            spend: parseFloat(insight.spend) || 0,
          };
        });

        console.log(`📊 Got ${insights.length} daily campaign insights`);

        // Ensure fields exist
        const fieldKeys = ['date', 'campaign_name', 'campaign_id', 'impressions', 'clicks', 'cpm', 'ctr', 'leads', 'cost_per_lead', 'spend'];
        const fieldNames = ['תאריך', 'שם הקמפיין', 'מזהה קמפיין', 'חשיפות', 'קליקים', 'עלות ל-1000 חשיפות', 'אחוז קליקים', 'לידים', 'עלות לליד', 'הוצאה'];
        const fieldTypes = ['date', 'text', 'text', 'number', 'number', 'number', 'number', 'number', 'number', 'number'];
        
        for (let i = 0; i < fieldKeys.length; i++) {
          const { data: existingField } = await supabase
            .from('crm_fields')
            .select('id')
            .eq('table_id', table.id)
            .eq('key', fieldKeys[i])
            .single();
          
          if (!existingField) {
            await supabase.from('crm_fields').insert({
              table_id: table.id,
              key: fieldKeys[i],
              name: fieldNames[i],
              type: fieldTypes[i],
              position: i,
            });
          }
        }

        // Delete old records and insert new ones
        await supabase
          .from('crm_records')
          .delete()
          .eq('table_id', table.id)
          .eq('tenant_id', table.tenant_id);

        // Insert new records
        for (const insight of insights) {
          await supabase.from('crm_records').insert({
            table_id: table.id,
            tenant_id: table.tenant_id,
            data: insight,
          });
        }

        // Update last_sync_at
        await supabase
          .from('crm_tables')
          .update({
            integration_settings: {
              ...settings,
              last_sync_at: new Date().toISOString(),
            }
          })
          .eq('id', table.id);

        console.log(`✅ Successfully synced ${insights.length} records for ${table.name}`);
        results.synced++;

      } catch (tableError: any) {
        console.error(`❌ Error syncing table ${table.name}:`, tableError.message);
        results.failed++;
        results.errors.push(`${table.name}: ${tableError.message}`);
      }
    }

    console.log(`\n🏁 Cron sync complete: ${results.synced} synced, ${results.failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      ...results,
      completed_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Cron sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
