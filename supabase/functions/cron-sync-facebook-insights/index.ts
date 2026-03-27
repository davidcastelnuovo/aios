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
  lp_or_form_views: number;
  cpm: number;
  ctr: number;
  leads: number;
  cost_per_lead: number;
  spend: number;
  purchases: number;
  purchase_value: number;
  add_to_cart: number;
  roas: number;
  campaign_objective: string | null;
  campaign_type: 'lead' | 'ecommerce' | 'other';
  effective_status?: string;
  configured_status?: string;
}

interface CampaignStatus {
  id: string;
  name: string;
  effective_status: string;
  configured_status: string;
  objective?: string | null;
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

        // First, fetch campaign statuses to detect real blocks
        const campaignsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?fields=id,name,effective_status,configured_status,objective&limit=500&access_token=${accessToken}`;
        const campaignsResponse = await fetch(campaignsUrl);
        const campaignsData = await campaignsResponse.json();
        
        const campaignStatuses: Record<string, CampaignStatus> = {};
        if (campaignsData.data) {
          for (const campaign of campaignsData.data) {
            campaignStatuses[campaign.id] = {
              id: campaign.id,
              name: campaign.name,
              effective_status: campaign.effective_status,
              configured_status: campaign.configured_status,
              objective: campaign.objective || null,
            };
          }
          console.log(`📋 Fetched statuses for ${Object.keys(campaignStatuses).length} campaigns`);
        }

        // Also fetch ad account status
        const accountUrl = `https://graph.facebook.com/v21.0/${adAccountId}?fields=account_status,disable_reason,name&access_token=${accessToken}`;
        const accountResponse = await fetch(accountUrl);
        const accountData = await accountResponse.json();
        
        let accountStatus = 'active';
        let accountDisableReason = null;
        if (accountData.account_status) {
          const statusMap: Record<number, string> = {
            1: 'active',
            2: 'disabled',
            3: 'unsettled',
            7: 'pending_risk_review',
            9: 'pending_settlement',
            101: 'closed',
          };
          accountStatus = statusMap[accountData.account_status] || `unknown_${accountData.account_status}`;
          accountDisableReason = accountData.disable_reason || null;
          console.log(`🏦 Account status: ${accountStatus}, disable_reason: ${accountDisableReason}`);
        }

        // Fetch insights from Facebook
        const insightsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,cpm,ctr,actions,action_values,conversions,cost_per_action_type,cost_per_conversion,spend&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&limit=500&access_token=${accessToken}`;
        
        const response = await fetch(insightsUrl);
        const data = await response.json();

        if (data.error) {
          console.error(`❌ Facebook API error for ${table.name}:`, data.error.message);
          results.failed++;
          results.errors.push(`${table.name}: ${data.error.message}`);
          continue;
        }

        // All lead action types to count.
        // Note: when the account uses a Custom Conversion as the "Result",
        // Facebook returns it as action_type like: offsite_conversion.custom.*
        const leadActionTypes = [
          'lead', // Aggregate lead count
          'leadgen_grouped', // Facebook Lead Forms
          'offsite_conversion.fb_pixel_lead', // Landing page leads (standard pixel event)
          'onsite_conversion.lead_grouped', // On-site leads
          'app_custom_event.fb_mobile_lead', // App leads
        ];
        const purchaseActionTypes = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'];
        const addToCartActionTypes = ['add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'];

        const insights: InsightRecord[] = (data.data || []).map((insight: any) => {
          const allActions = [...(insight.actions ?? []), ...(insight.conversions ?? [])];
          const actionValues = insight.action_values ?? [];
          const actionTypeSet = new Set(allActions.map((a: any) => String(a.action_type || '')));

          const getActionCount = (actionTypes: string[]) =>
            allActions
              .filter((a: any) => actionTypes.includes(String(a.action_type || '')))
              .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);

          const getActionValue = (actionTypes: string[]) =>
            actionValues
              .filter((a: any) => actionTypes.includes(String(a.action_type || '')))
              .reduce((sum: number, a: any) => sum + (parseFloat(a.value) || 0), 0);

          // Extract lead count
          let leads = 0;
          const aggregateLeadAction = allActions.find((a: any) => a.action_type === 'lead');
          if (aggregateLeadAction) {
            // If 'lead' exists, it's the aggregate - use it
            leads = parseInt(aggregateLeadAction.value) || 0;
          } else {
            // Otherwise, sum up all other lead-like types + custom conversions
            leads = allActions
              .filter((a: any) => {
                const type = String(a.action_type || '');
                return (
                  leadActionTypes.slice(1).includes(type) ||
                  type.startsWith('offsite_conversion.custom')
                );
              })
              .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);
          }

          // Extract landing page views (Facebook action)
          const landingPageViews = allActions
            .filter((a: any) => String(a.action_type || '') === 'landing_page_view')
            .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);

          // Extract form opens for Lead Form campaigns
          const formOpens = allActions
            .filter((a: any) => {
              const type = String(a.action_type || '');
              return type === 'leadgen_form_opened' || type === 'lead_form_open';
            })
            .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);

          // Detect Lead Form campaigns (so we don't accidentally use landing page views)
          const leadFormLeads = allActions
            .filter((a: any) => String(a.action_type || '') === 'leadgen_grouped')
            .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);

          const isLeadFormCampaign = leadFormLeads > 0 || formOpens > 0;

          // For Lead Form campaigns: use *form opens*.
          // For Website/LP campaigns: use *landing page views*.
          const lpOrFormViews = isLeadFormCampaign ? formOpens : landingPageViews;

          // Extract cost per lead - always calculate as spend / leads for accuracy
          // This ensures CPL matches what Facebook shows when aggregating
          let costPerLead = 0;
          const spend = parseFloat(insight.spend) || 0;
          if (leads > 0) {
            costPerLead = spend / leads;
          }

          const purchases = getActionCount(purchaseActionTypes);
          const purchaseValue = getActionValue(purchaseActionTypes);
          const addToCart = getActionCount(addToCartActionTypes);
          const roas = spend > 0 ? purchaseValue / spend : 0;

          // Get campaign status
          const campaignStatus = campaignStatuses[insight.campaign_id];
          const objective = String(campaignStatus?.objective || '').toUpperCase();
          const isEcommerceObjective = ['OUTCOME_SALES', 'PRODUCT_CATALOG_SALES', 'SALES'].includes(objective);
          const isLeadObjective = ['OUTCOME_LEADS', 'LEAD_GENERATION'].includes(objective);
          const hasEcommerceSignal =
            purchases > 0 ||
            purchaseValue > 0 ||
            addToCart > 0 ||
            purchaseActionTypes.some((type) => actionTypeSet.has(type)) ||
            addToCartActionTypes.some((type) => actionTypeSet.has(type));
          const hasLeadSignal =
            leads > 0 ||
            leadActionTypes.some((type) => actionTypeSet.has(type)) ||
            Array.from(actionTypeSet).some((type) => type.startsWith('offsite_conversion.custom'));

          const campaignType: 'lead' | 'ecommerce' | 'other' =
            hasEcommerceSignal || isEcommerceObjective
              ? 'ecommerce'
              : hasLeadSignal || isLeadObjective
                ? 'lead'
                : 'other';

          return {
            date: insight.date_start,
            campaign_id: insight.campaign_id,
            campaign_name: insight.campaign_name,
            impressions: parseInt(insight.impressions) || 0,
            clicks: parseInt(insight.clicks) || 0,
            lp_or_form_views: lpOrFormViews,
            cpm: parseFloat(insight.cpm) || 0,
            ctr: parseFloat(insight.ctr) || 0,
            leads,
            cost_per_lead: costPerLead,
            spend: parseFloat(insight.spend) || 0,
            purchases,
            purchase_value: purchaseValue,
            add_to_cart: addToCart,
            roas,
            campaign_objective: campaignStatus?.objective || null,
            campaign_type: campaignType,
            effective_status: campaignStatus?.effective_status || null,
            configured_status: campaignStatus?.configured_status || null,
          };
        });

        console.log(`📊 Got ${insights.length} daily campaign insights`);

        // Ensure fields exist
        const fieldKeys = ['date', 'campaign_name', 'campaign_id', 'impressions', 'clicks', 'lp_or_form_views', 'cpm', 'ctr', 'leads', 'cost_per_lead', 'spend', 'purchases', 'purchase_value', 'add_to_cart', 'roas', 'campaign_objective', 'campaign_type', 'effective_status', 'configured_status'];
        const fieldNames = ['תאריך', 'שם הקמפיין', 'מזהה קמפיין', 'חשיפות', 'קליקים', 'צפיות LP / פתיחות טופס', 'עלות ל-1000 חשיפות', 'אחוז קליקים', 'לידים', 'עלות לליד', 'הוצאה', 'רכישות', 'ערך רכישות', 'הוספות לעגלה', 'ROAS', 'מטרת קמפיין', 'סוג קמפיין', 'סטטוס בפועל', 'סטטוס מוגדר'];
        const fieldTypes = ['date', 'text', 'text', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'text', 'text', 'text', 'text'];
        
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

        // Update last_sync_at and account status
        await supabase
          .from('crm_tables')
          .update({
            integration_settings: {
              ...settings,
              last_sync_at: new Date().toISOString(),
              account_status: accountStatus,
              account_disable_reason: accountDisableReason,
            }
          })
          .eq('id', table.id);

        console.log(`✅ Successfully synced ${insights.length} records for ${table.name}`);
        results.synced++;

        // === Check report_alerts and trigger automations ===
        try {
          const { data: alerts } = await supabase
            .from('report_alerts')
            .select('*')
            .eq('table_id', table.id)
            .eq('tenant_id', table.tenant_id)
            .eq('is_active', true);

          if (alerts && alerts.length > 0) {
            console.log(`🔔 Checking ${alerts.length} active alerts for ${table.name}`);

            // Aggregate campaign data for alert evaluation
            const campaignAggregates: Record<string, { spend: number; leads: number; cost_per_lead: number; impressions: number; clicks: number; effective_status: string; campaign_name: string }> = {};
            for (const insight of insights) {
              if (!campaignAggregates[insight.campaign_id]) {
                campaignAggregates[insight.campaign_id] = { spend: 0, leads: 0, cost_per_lead: 0, impressions: 0, clicks: 0, effective_status: insight.effective_status || '', campaign_name: insight.campaign_name };
              }
              const agg = campaignAggregates[insight.campaign_id];
              agg.spend += insight.spend;
              agg.leads += insight.leads;
              agg.impressions += insight.impressions;
              agg.clicks += insight.clicks;
              agg.effective_status = insight.effective_status || agg.effective_status;
            }
            // Compute CPL
            for (const cid of Object.keys(campaignAggregates)) {
              const agg = campaignAggregates[cid];
              agg.cost_per_lead = agg.leads > 0 ? agg.spend / agg.leads : 0;
            }

            for (const alert of alerts) {
              // Rate-limit: once per 24h per alert
              if (alert.last_triggered_at) {
                const lastTriggered = new Date(alert.last_triggered_at);
                const hoursSince = (Date.now() - lastTriggered.getTime()) / (1000 * 60 * 60);
                if (hoursSince < 24) {
                  console.log(`⏭️ Alert "${alert.name}" already triggered ${hoursSince.toFixed(1)}h ago, skipping`);
                  continue;
                }
              }

              // Evaluate alert against each campaign
              for (const [campaignId, agg] of Object.entries(campaignAggregates)) {
                const metric = alert.metric; // e.g. 'cost_per_lead', 'spend', 'effective_status'
                let currentValue: number | string = 0;

                if (metric === 'effective_status') {
                  // Status-based alert: check for blocked/paused campaigns
                  const problemStatuses = ['DISAPPROVED', 'WITH_ISSUES', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'];
                  if (!problemStatuses.includes(agg.effective_status)) continue;
                  currentValue = agg.effective_status;
                } else {
                  currentValue = (agg as any)[metric] || 0;
                  const threshold = alert.threshold;
                  const op = alert.operator; // '>', '<', '>=', '<='
                  let triggered = false;
                  if (op === '>' && (currentValue as number) > threshold) triggered = true;
                  if (op === '<' && (currentValue as number) < threshold) triggered = true;
                  if (op === '>=' && (currentValue as number) >= threshold) triggered = true;
                  if (op === '<=' && (currentValue as number) <= threshold) triggered = true;
                  if (!triggered) continue;
                }

                console.log(`🚨 Alert "${alert.name}" triggered for campaign "${agg.campaign_name}" (${metric}: ${currentValue})`);

                // Get table name for context
                const tableName = table.name;

                // Determine alert type description
                let alertType = metric === 'effective_status' ? 'חסימת קמפיין' : metric === 'cost_per_lead' ? 'עלייה בעלות לליד' : metric === 'spend' ? 'חריגה בהוצאות' : metric;

                // Call trigger-automation
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    trigger_type: 'report_alert_triggered',
                    tenant_id: table.tenant_id,
                    data: {
                      alert_name: alert.name,
                      campaign_name: agg.campaign_name,
                      campaign_id: campaignId,
                      alert_type: alertType,
                      current_value: String(currentValue),
                      previous_value: '',
                      change_percent: '',
                      table_name: tableName,
                      metric,
                      spend: agg.spend,
                      leads: agg.leads,
                      cost_per_lead: agg.cost_per_lead,
                    },
                  }),
                });

                // Update last_triggered_at
                await supabase
                  .from('report_alerts')
                  .update({
                    last_triggered_at: new Date().toISOString(),
                    last_triggered_data: {
                      campaign_name: agg.campaign_name,
                      campaign_id: campaignId,
                      metric,
                      value: currentValue,
                      triggered_at: new Date().toISOString(),
                    },
                  })
                  .eq('id', alert.id);

                // Break after first triggered campaign per alert to avoid spam
                break;
              }
            }
          }
        } catch (alertError: any) {
          console.error(`⚠️ Error checking alerts for ${table.name}:`, alertError.message);
        }

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
