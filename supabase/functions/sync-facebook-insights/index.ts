import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  form_leads: number;
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
  updated_time?: string | null;
}

interface CampaignStatus {
  id: string;
  name: string;
  effective_status: string;
  configured_status: string;
  objective?: string | null;
  updated_time?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { table_id } = await req.json();
    
    if (!table_id) {
      return new Response(JSON.stringify({ error: 'table_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get table with integration settings - let RLS handle access control
    const { data: table, error: tableError } = await supabase
      .from('crm_tables')
      .select('*')
      .eq('id', table_id)
      .maybeSingle();

    if (tableError || !table) {
      console.error('Table lookup error:', tableError, 'table_id:', table_id);
      return new Response(JSON.stringify({ error: 'Table not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Use the table's tenant_id for subsequent operations
    const tableTenantId = table.tenant_id;

    if (table.integration_type !== 'facebook_insights') {
      return new Response(JSON.stringify({ error: 'Table is not a Facebook Insights table' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = table.integration_settings || {};
    const adAccountId = settings.ad_account_id;
    const dateRange = settings.date_range || 'last_30_days';

    if (!adAccountId) {
      return new Response(JSON.stringify({ error: 'No ad account configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Facebook access token (including shared integrations)
    let { data: integration } = await supabase
      .from('tenant_integrations')
      .select('api_key, shared_from_integration_id')
      .eq('tenant_id', tableTenantId)
      .in('integration_type', ['facebook', 'facebook_lead_ads'])
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    // If this is a shared integration, fetch the source integration's token
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
      return new Response(JSON.stringify({ error: 'Facebook not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = integration.api_key;

    // Calculate date range
    const now = new Date();
    let since: Date;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let until = new Date(today);

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
        until = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case 'last_14_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
        until = today;
        break;
      case 'this_month':
        since = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_30_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        until = today;
        break;
      case 'last_90_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
        until = today;
        break;
      case 'last_180_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 180);
        until = today;
        break;
      case 'last_365_days':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365);
        until = today;
        break;
      default:
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        until = today;
    }

    const sinceStr = since.toISOString().split('T')[0];
    const untilStr = until.toISOString().split('T')[0];


    // First, fetch campaign statuses to detect real blocks
    const campaignsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?fields=id,name,effective_status,configured_status,objective,updated_time&limit=500&access_token=${accessToken}`;
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
          updated_time: campaign.updated_time || null,
        };
      }
    }

    // Also fetch ad account status
    const accountUrl = `https://graph.facebook.com/v21.0/${adAccountId}?fields=account_status,disable_reason,name&access_token=${accessToken}`;
    const accountResponse = await fetch(accountUrl);
    const accountData = await accountResponse.json();
    
    let accountStatus = 'active';
    let accountDisableReason = null;
    if (accountData.account_status) {
      // account_status: 1=Active, 2=Disabled, 3=Unsettled, 7=Pending Risk Review, 9=Pending Settlement, 101=Closed
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
    }

    // Fetch insights from Facebook with time_increment=1 for daily breakdown
    // action_attribution_windows + use_unified_attribution_setting expose messaging
    // conversion events (WhatsApp / Messenger Click-to-Chat) that otherwise don't
    // appear in the default `actions` response.
    const attributionWindows = encodeURIComponent(JSON.stringify(['7d_click', '1d_view']));
    const insightsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,cpm,ctr,actions,action_values,conversions,cost_per_action_type,cost_per_conversion,spend&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&action_attribution_windows=${attributionWindows}&use_unified_attribution_setting=true&limit=500&access_token=${accessToken}`;
    
    const response = await fetch(insightsUrl);
    const data = await response.json();

    if (data.error) {
      console.error('Facebook API error:', data.error);
      return new Response(JSON.stringify({ 
        error: 'Facebook API error',
        details: data.error.message
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // All lead action types to count.
    // Note: when the account uses a Custom Conversion as the "Result" (כמו בתמונה),
    // Facebook returns it as action_type like: offsite_conversion.custom.*
    const leadActionTypes = [
      'lead', // Aggregate lead count
      'leadgen_grouped', // Facebook Lead Forms
      'offsite_conversion.fb_pixel_lead', // Landing page leads (standard pixel event)
      'onsite_conversion.lead_grouped', // On-site leads
      'app_custom_event.fb_mobile_lead', // App leads
      // WhatsApp / Messaging conversions
      'onsite_conversion.messaging_conversation_started_7d',
      'messaging_conversation_started_7d',
      'onsite_conversion.messaging_first_reply',
      'messaging_first_reply',
    ];
    // IMPORTANT: Facebook returns the same conversion under multiple action_types
    // (e.g. 'purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase' all
    // refer to the same event). Summing all of them causes 2-3x inflation vs the
    // Ads Manager UI. We pick ONE canonical type per metric, with fallbacks.
    const purchaseActionTypePriority = [
      'omni_purchase', // Facebook's deduplicated total (matches "Purchases" in Ads Manager)
      'offsite_conversion.fb_pixel_purchase', // Pure website pixel purchases
      'purchase', // Legacy aggregate
    ];
    const addToCartActionTypePriority = [
      'omni_add_to_cart',
      'offsite_conversion.fb_pixel_add_to_cart',
      'add_to_cart',
    ];

    console.log(`[sync-facebook-insights] Got ${(data.data || []).length} insight rows from FB`);

    const insights: InsightRecord[] = (data.data || []).map((insight: any) => {
      const allActions = [...(insight.actions ?? []), ...(insight.conversions ?? [])];
      const actionValues = insight.action_values ?? [];
      const actionTypeSet = new Set(allActions.map((a: any) => String(a.action_type || '')));

      // Debug: log action types for messaging campaigns to help diagnose lead-counting issues
      const _msgTypes = Array.from(actionTypeSet).filter((t: any) => String(t).includes('messaging') || String(t) === 'lead' || String(t).includes('leadgen'));
      if (_msgTypes.length > 0) {
        console.log(`[sync-facebook-insights] ${insight.campaign_name} (${insight.date_start}) lead/messaging action_types:`, _msgTypes);
      }

      const getActionCount = (actionTypes: string[]) =>
        allActions
          .filter((a: any) => actionTypes.includes(String(a.action_type || '')))
          .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);

      const getActionValue = (actionTypes: string[]) =>
        actionValues
          .filter((a: any) => actionTypes.includes(String(a.action_type || '')))
          .reduce((sum: number, a: any) => sum + (parseFloat(a.value) || 0), 0);

      // Lead counting — objective-aware, matches Facebook Ads Manager "Results" column.
      // CRITICAL: never sum aggregate `lead` action_type with specific lead types — this
      // double-counts because FB's `lead` is an aggregate of leadgen + pixel + messaging.
      const sumByTypes = (types: string[]) =>
        allActions
          .filter((a: any) => types.includes(String(a.action_type || '')))
          .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);

      const _campaignStatusForLeads = campaignStatuses[insight.campaign_id];
      const _objectiveForLeads = String(_campaignStatusForLeads?.objective || '').toUpperCase();
      const _isLeadFormObjective = ['OUTCOME_LEADS', 'LEAD_GENERATION'].includes(_objectiveForLeads);
      const _isMessagingObjective = ['OUTCOME_ENGAGEMENT', 'MESSAGES'].includes(_objectiveForLeads);

      const _formLeadsValue = sumByTypes(['leadgen.other', 'leadgen_grouped', 'onsite_conversion.lead_grouped']);
      const _messagingLeadsValue = sumByTypes([
        'onsite_conversion.messaging_conversation_started_7d',
        'messaging_conversation_started_7d',
      ]);
      const _pixelLeadsValue = sumByTypes(['offsite_conversion.fb_pixel_lead']);
      const _customConversionLeadsValue = allActions
        .filter((a: any) => String(a.action_type || '').startsWith('offsite_conversion.custom'))
        .reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);

      let leads: number;
      if (_isLeadFormObjective) {
        // Lead-form campaigns: FB shows ONLY form leads in "Results". Pixel/messaging
        // events on this campaign are not attributed to it as leads.
        leads = _formLeadsValue;
      } else if (_isMessagingObjective) {
        // Messaging campaigns: count conversation starts (matches FB Results column).
        leads = _messagingLeadsValue;
      } else {
        // Other campaigns (Traffic/Awareness/Conversions/etc): take the largest single
        // attributed signal — never sum, to avoid double counting the same lead across
        // multiple action_types (FB returns the same conversion under several types).
        leads = Math.max(
          _formLeadsValue,
          _messagingLeadsValue,
          _pixelLeadsValue,
          _customConversionLeadsValue,
        );
      }
      const _leadgenGroupedValue = _formLeadsValue;

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

      // Pick the first matching action_type (deduplicated) instead of summing all,
      // to mirror Facebook Ads Manager's "Purchases" / "Website purchases" column.
      const pickFirstAvailable = (priority: string[]) => {
        for (const type of priority) {
          if (actionTypeSet.has(type)) return [type];
        }
        return [];
      };
      const effectivePurchaseTypes = pickFirstAvailable(purchaseActionTypePriority);
      const effectiveAddToCartTypes = pickFirstAvailable(addToCartActionTypePriority);

      const purchases = getActionCount(effectivePurchaseTypes);
      const purchaseValue = getActionValue(effectivePurchaseTypes);
      const addToCart = getActionCount(effectiveAddToCartTypes);
      const roas = spend > 0 ? purchaseValue / spend : 0;

      // Get campaign status
      const campaignStatus = campaignStatuses[insight.campaign_id];
      const objective = String(campaignStatus?.objective || '').toUpperCase();
      const isEcommerceObjective = ['OUTCOME_SALES', 'PRODUCT_CATALOG_SALES', 'SALES'].includes(objective);
      const isLeadObjective = ['OUTCOME_LEADS', 'LEAD_GENERATION'].includes(objective);
      const isMessagingObjective = ['OUTCOME_ENGAGEMENT', 'MESSAGES'].includes(objective);

      // Messaging / WhatsApp conversation starts count as leads for Engagement campaigns
      const messagingActionTypes = [
        'onsite_conversion.messaging_conversation_started_7d',
        'messaging_conversation_started_7d',
        'onsite_conversion.messaging_first_reply',
        'messaging_first_reply',
      ];
      const hasMessagingSignal = messagingActionTypes.some((type) => actionTypeSet.has(type));

      const hasEcommerceSignal =
        purchases > 0 ||
        purchaseValue > 0 ||
        purchaseActionTypePriority.some((type) => actionTypeSet.has(type));
      // add_to_cart alone is NOT enough to classify as ecommerce —
      // lead campaigns can have incidental add-to-cart events.
      const hasStrongEcommerceSignal = hasEcommerceSignal || isEcommerceObjective;
      const hasLeadSignal =
        leads > 0 ||
        leadActionTypes.some((type) => actionTypeSet.has(type)) ||
        Array.from(actionTypeSet).some((type) => type.startsWith('offsite_conversion.custom'));

      // PRIORITY: Campaign objective is the source of truth.
      // If FB says it's a lead campaign (OUTCOME_LEADS / LEAD_GENERATION), it's a lead
      // campaign — even with incidental purchase/add_to_cart pixel events from the website.
      // Messaging/Engagement campaigns with WhatsApp/Messenger conversions also count as leads.
      const campaignType: 'lead' | 'ecommerce' | 'other' =
        isLeadObjective
          ? 'lead'
          : isMessagingObjective && hasMessagingSignal
            ? 'lead'
            : isEcommerceObjective
              ? 'ecommerce'
              : hasStrongEcommerceSignal && !(hasLeadSignal && purchases === 0 && purchaseValue === 0)
                ? 'ecommerce'
                : hasLeadSignal
                  ? 'lead'
                  : addToCart > 0 || addToCartActionTypePriority.some((type) => actionTypeSet.has(type))
                    ? 'ecommerce'
                    : 'other';

      return {
        date: insight.date_start, // Use date_start as the single date field
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        impressions: parseInt(insight.impressions) || 0,
        clicks: parseInt(insight.clicks) || 0,
        lp_or_form_views: lpOrFormViews,
        cpm: parseFloat(insight.cpm) || 0,
        ctr: parseFloat(insight.ctr) || 0,
        leads,
        form_leads: _leadgenGroupedValue,
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
        updated_time: campaignStatus?.updated_time || null,
      };
    });


    // Make sure fields exist for Facebook Insights table
    const fieldKeys = ['date', 'campaign_name', 'campaign_id', 'impressions', 'clicks', 'lp_or_form_views', 'cpm', 'ctr', 'leads', 'form_leads', 'cost_per_lead', 'spend', 'purchases', 'purchase_value', 'add_to_cart', 'roas', 'campaign_objective', 'campaign_type', 'effective_status', 'configured_status', 'updated_time'];
    const fieldNames = ['תאריך', 'שם הקמפיין', 'מזהה קמפיין', 'חשיפות', 'קליקים', 'צפיות LP / פתיחות טופס', 'עלות ל-1000 חשיפות', 'אחוז קליקים', 'לידים', 'לידים מטופס', 'עלות לליד', 'הוצאה', 'רכישות', 'ערך רכישות', 'הוספות לעגלה', 'ROAS', 'מטרת קמפיין', 'סוג קמפיין', 'סטטוס בפועל', 'סטטוס מוגדר', 'עדכון אחרון בקמפיין'];
    const fieldTypes = ['date', 'text', 'text', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'text', 'text', 'text', 'text', 'text'];
    
    for (let i = 0; i < fieldKeys.length; i++) {
      const { data: existingField } = await supabase
        .from('crm_fields')
        .select('id')
        .eq('table_id', table_id)
        .eq('key', fieldKeys[i])
        .single();
      
      if (!existingField) {
        await supabase.from('crm_fields').insert({
          table_id,
          key: fieldKeys[i],
          name: fieldNames[i],
          type: fieldTypes[i],
          position: i,
        });
      }
    }

    // Delete old fields that are no longer needed (date_start, date_stop, landing_page_views)
    await supabase.from('crm_fields')
      .delete()
      .eq('table_id', table_id)
      .in('key', ['date_start', 'date_stop', 'landing_page_views']);

    // Delete existing records and insert new ones
    await supabase
      .from('crm_records')
      .delete()
      .eq('table_id', table_id)
      .eq('tenant_id', tableTenantId);

    // Insert new records
    for (const insight of insights) {
      await supabase.from('crm_records').insert({
        table_id,
        tenant_id: tableTenantId,
        created_by: user.id,
        data: insight,
      });
    }

    // Update last_sync_at and account status in integration_settings
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
      .eq('id', table_id);


    return new Response(JSON.stringify({ 
      success: true,
      records_synced: insights.length,
      account_status: accountStatus,
      last_sync_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in sync-facebook-insights:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
