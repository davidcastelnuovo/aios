import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { fireIntegrationAlert } from '../_shared/fireIntegrationAlert.ts';
import {
  buildInsightRecord,
  type CampaignStatus,
  type InsightRecord,
  FB_INSIGHTS_FIELD_KEYS,
  FB_INSIGHTS_FIELD_NAMES,
  FB_INSIGHTS_FIELD_TYPES,
} from '../_shared/fbInsights.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 8;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse batch params
    let body: any = {};
    try { body = await req.json(); } catch {}
    const batchOffset = body.batch_offset || 0;
    const tableIds: string[] | null = body.table_ids || null;

    // Get Facebook Insights tables
    let query = supabase
      .from('crm_tables')
      .select('*')
      .eq('integration_type', 'facebook_insights')
      .order('id');

    if (tableIds && tableIds.length > 0) {
      query = query.in('id', tableIds);
    }

    const { data: allTables, error: tablesError } = await query;

    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      throw tablesError;
    }

    // Slice for current batch
    const tables = (allTables || []).slice(batchOffset, batchOffset + BATCH_SIZE);
    const hasMore = (allTables || []).length > batchOffset + BATCH_SIZE;

    const results = {
      total: (allTables || []).length,
      batch_offset: batchOffset,
      batch_size: tables.length,
      has_more: hasMore,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const table of tables || []) {
      try {
        
        const settings = table.integration_settings || {};
        const adAccountId = settings.ad_account_id;
        const dateRange = settings.date_range || 'last_30_days';
        const previousAccountStatus: string | null = settings.account_status || null;

        if (!adAccountId) {
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
          continue;
        }

        const accessToken = integration.api_key;

        // Calculate date range
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let since: Date;
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
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
            until = today;
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

        // Fetch insights from Facebook.
        // use_unified_attribution_setting=true makes FB return numbers that match
        // the Ads Manager UI; we must NOT pass action_attribution_windows (that
        // makes `value` the SUM across windows and double/triple counts results).
        const insightsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,cpm,ctr,actions,action_values,conversions,cost_per_action_type,cost_per_conversion,spend&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&use_unified_attribution_setting=true&limit=500&access_token=${accessToken}`;

        // Paginate through ALL pages. A single page caps at 500 rows; busy accounts
        // (many campaign×day rows) would otherwise be truncated, dropping the most
        // recent dates (Facebook returns rows oldest-first).
        const data: any = { data: [] };
        {
          let next: string | null = insightsUrl;
          while (next) {
            const r = await fetch(next);
            const d: any = await r.json();
            if (d.error) { data.error = d.error; break; }
            if (Array.isArray(d.data)) data.data.push(...d.data);
            next = d.paging?.next || null;
          }
        }

        if (data.error) {
          console.error(`❌ Facebook API error for ${table.name}:`, data.error.message);
          results.failed++;
          results.errors.push(`${table.name}: ${data.error.message}`);
          continue;
        }

        // Build CRM records via the shared helper so the cron and the manual
        // `sync-facebook-insights` function count leads identically (incl.
        // `offsite_conversion.fb_pixel_custom.*` custom conversions like NewLead).
        const insights: InsightRecord[] = (data.data || []).map((insight: any) =>
          buildInsightRecord(insight, campaignStatuses)
        );


        // Ensure fields exist (shared schema, identical to the manual sync)
        const fieldKeys = FB_INSIGHTS_FIELD_KEYS;
        const fieldNames = FB_INSIGHTS_FIELD_NAMES;
        const fieldTypes = FB_INSIGHTS_FIELD_TYPES;
        
        // Bulk-ensure fields exist: one read for all keys, one insert for the missing ones.
        const { data: existingFields } = await supabase
          .from('crm_fields')
          .select('key')
          .eq('table_id', table.id);
        const existingFieldKeys = new Set((existingFields || []).map((f: any) => f.key));
        const fieldsToInsert = fieldKeys
          .map((key, i) => ({ table_id: table.id, key, name: fieldNames[i], type: fieldTypes[i], position: i }))
          .filter((f) => !existingFieldKeys.has(f.key));
        if (fieldsToInsert.length > 0) {
          await supabase.from('crm_fields').insert(fieldsToInsert);
        }

        // Delete old records and insert new ones
        await supabase
          .from('crm_records')
          .delete()
          .eq('table_id', table.id)
          .eq('tenant_id', table.tenant_id);

        // Bulk insert new records (one round-trip per chunk instead of one per row)
        if (insights.length > 0) {
          const recordRows = insights.map((insight) => ({
            table_id: table.id,
            tenant_id: table.tenant_id,
            data: insight,
          }));
          const INSERT_CHUNK = 500;
          for (let i = 0; i < recordRows.length; i += INSERT_CHUNK) {
            const { error: insertError } = await supabase
              .from('crm_records')
              .insert(recordRows.slice(i, i + INSERT_CHUNK));
            if (insertError) throw insertError;
          }
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

        results.synced++;

        // Helper: notify David (the operator) via WhatsApp (Green API).
        // ⛔ KILL SWITCH — disabled per operator request (2026-05-11).
        // The cron was sending repeated WhatsApp alerts for inactive accounts
        // without proper deduplication. Re-enable only after fixing the
        // transition-detection logic so it fires once per status change.
        const notifyCampaignerWA = async (_message: string) => {
          return; // disabled
        };

        // === Account-level billing/disable alert ===
        // Trigger when account_status transitions into a problematic state.
        try {
          const problemStatuses = ['disabled', 'unsettled', 'pending_settlement', 'pending_risk_review', 'closed'];
          if (problemStatuses.includes(accountStatus) && accountStatus !== previousAccountStatus) {
            const statusLabels: Record<string, string> = {
              disabled: 'חשבון מושבת',
              unsettled: 'בעיית חיוב (חוב לא משולם)',
              pending_settlement: 'ממתין להסדר תשלום',
              pending_risk_review: 'בבדיקת סיכון',
              closed: 'חשבון סגור',
            };
            const statusLabel = statusLabels[accountStatus] || accountStatus;
            const taskTitle = `🚨 בעיית חיוב/חשבון מודעות — ${table.name}`;
            const taskDescription = `חשבון המודעות של "${table.name}" (${adAccountId}) נכנס למצב: ${statusLabel}.\nסיבה: ${accountDisableReason || 'לא צוינה'}.\nיש לבדוק את אמצעי התשלום בפייסבוק ולעדכן את הלקוח.`;

            const { data: agent } = await supabase
              .from('ai_agents')
              .select('id')
              .eq('tenant_id', table.tenant_id)
              .eq('active', true)
              .limit(1)
              .maybeSingle();

            if (agent) {
              await supabase.from('agent_tasks').insert({
                tenant_id: table.tenant_id,
                agent_id: agent.id,
                title: taskTitle,
                description: taskDescription,
                status: 'open',
                priority: 1,
                task_mode: 'anomaly_alert',
              });
            }

            await fireIntegrationAlert({
              tenant_id: table.tenant_id,
              provider: 'facebook',
              alert_type: 'blocked',
              account_id: adAccountId,
              account_name: table.name,
              reason: accountDisableReason || statusLabel,
            });


            // Direct WhatsApp fallback so the alert always reaches the team
            await notifyCampaignerWA(`🚨 ${taskTitle}\n${statusLabel}${accountDisableReason ? ` — ${accountDisableReason}` : ''}\nחשבון: ${adAccountId}`);
          }
        } catch (billingErr: any) {
          console.error(`[billing-alert] ${table.name}:`, billingErr?.message);
        }

        // === Campaign-level status alerts (official Facebook signals) ===
        // Use effective_status (DISAPPROVED / PENDING_BILLING_INFO / WITH_ISSUES /
        // PENDING_REVIEW) instead of spend heuristics. PAUSED/ARCHIVED ignored.
        try {
          const todayMs = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          const sevenDaysAgo = new Date(todayMs - 7 * dayMs).toISOString();

          const ignoredStatuses = new Set([
            'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED',
            'ARCHIVED', 'DELETED', 'IN_PROCESS',
          ]);

          const statusAlerts: Array<{ status: string; emoji: string; label: string; campaigns: CampaignStatus[] }> = [];
          const buckets: Record<string, { emoji: string; label: string; campaigns: CampaignStatus[] }> = {
            DISAPPROVED: { emoji: '❌', label: 'קמפיין נדחה ע״י פייסבוק', campaigns: [] },
            PENDING_BILLING_INFO: { emoji: '💳', label: 'חסרים פרטי חיוב', campaigns: [] },
            WITH_ISSUES: { emoji: '⚠️', label: 'בעיה בקמפיין', campaigns: [] },
          };

          for (const campaign of Object.values(campaignStatuses)) {
            // Only alert if the user actually wants this campaign running.
            // Skip campaigns the user paused/archived themselves.
            if (campaign.configured_status !== 'ACTIVE') continue;
            const status = campaign.effective_status;
            if (ignoredStatuses.has(status)) continue;
            if (buckets[status]) buckets[status].campaigns.push(campaign);
          }

          for (const [status, bucket] of Object.entries(buckets)) {
            if (bucket.campaigns.length === 0) continue;
            statusAlerts.push({ status, ...bucket });
          }

          // Find Carmen agent once
          const { data: agent } = await supabase
            .from('ai_agents')
            .select('id')
            .eq('tenant_id', table.tenant_id)
            .eq('active', true)
            .limit(1)
            .maybeSingle();

          for (const alert of statusAlerts) {
            for (const campaign of alert.campaigns) {
              const taskTitle = `${alert.emoji} ${alert.label}: ${campaign.name}`;
              // Dedup: skip if same title open within last 7 days
              const { data: existing } = await supabase
                .from('agent_tasks')
                .select('id')
                .eq('tenant_id', table.tenant_id)
                .eq('title', taskTitle)
                .gte('created_at', sevenDaysAgo)
                .limit(1);
              if (existing && existing.length > 0) continue;

              let extraInfo = '';
              if (alert.status === 'WITH_ISSUES') {
                try {
                  const issuesRes = await fetch(
                    `https://graph.facebook.com/v21.0/${campaign.id}?fields=issues_info&access_token=${accessToken}`
                  );
                  const issuesData = await issuesRes.json();
                  if (Array.isArray(issuesData?.issues_info) && issuesData.issues_info.length > 0) {
                    extraInfo = '\n\nפרטי הבעיה: ' +
                      issuesData.issues_info
                        .map((i: any) => i.error_summary || i.error_message || i.level)
                        .filter(Boolean)
                        .join(' | ');
                  }
                } catch { /* ignore */ }
              }

              if (agent) {
                await supabase.from('agent_tasks').insert({
                  tenant_id: table.tenant_id,
                  agent_id: agent.id,
                  title: taskTitle,
                  description: `הקמפיין "${campaign.name}" (${campaign.id}) בחשבון "${table.name}" במצב: ${alert.label} (${alert.status}).${extraInfo}\n\nזהו אות סטטוס רשמי מפייסבוק. בדקי ועדכני את הצוות.`,
                  status: 'open',
                  priority: 1,
                  task_mode: 'anomaly_alert',
                });
              }
            }
          }
        } catch (statusErr: any) {
          console.error(`[campaign-status-alert] ${table.name}:`, statusErr?.message);
        }

        // === Soft spend-drop alert (account-level, weekly dedup) ===
        // Only ACTIVE campaigns; only fully-closed days (-3..-1 vs -10..-4).
        try {
          const todayMs = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          const fmt = (d: Date) => d.toISOString().split('T')[0];
          const recentStart = fmt(new Date(todayMs - 3 * dayMs));
          const recentEnd = fmt(new Date(todayMs - 1 * dayMs));
          const priorStart = fmt(new Date(todayMs - 10 * dayMs));
          const priorEnd = fmt(new Date(todayMs - 4 * dayMs));
          const sevenDaysAgo = new Date(todayMs - 7 * dayMs).toISOString();

          const activeCampaignIds = new Set(
            Object.values(campaignStatuses)
              .filter((c) => c.configured_status === 'ACTIVE' && c.effective_status === 'ACTIVE')
              .map((c) => c.id)
          );

          const perCampaign: Record<string, { name: string; recent: number; prior: number }> = {};
          for (const ins of insights) {
            if (!activeCampaignIds.has(ins.campaign_id)) continue;
            const c = perCampaign[ins.campaign_id] ||= { name: ins.campaign_name, recent: 0, prior: 0 };
            if (ins.date >= recentStart && ins.date <= recentEnd) c.recent += ins.spend;
            else if (ins.date >= priorStart && ins.date <= priorEnd) c.prior += ins.spend;
          }

          const stoppedCampaigns = Object.entries(perCampaign)
            .filter(([, agg]) => agg.recent === 0 && agg.prior > 5)
            .map(([cid, agg]) => ({ cid, ...agg }));

          if (stoppedCampaigns.length > 0) {
            const taskTitle = `📉 ירידה חדה בהוצאה — חשבון ${table.name}`;
            const { data: existing } = await supabase
              .from('agent_tasks')
              .select('id')
              .eq('tenant_id', table.tenant_id)
              .eq('title', taskTitle)
              .gte('created_at', sevenDaysAgo)
              .limit(1);

            if (!existing || existing.length === 0) {
              const { data: agent } = await supabase
                .from('ai_agents')
                .select('id')
                .eq('tenant_id', table.tenant_id)
                .eq('active', true)
                .limit(1)
                .maybeSingle();

              if (agent) {
                const list = stoppedCampaigns
                  .map((c) => `• ${c.name} (הוציא ${c.prior.toFixed(2)} בשבוע הקודם)`)
                  .join('\n');
                await supabase.from('agent_tasks').insert({
                  tenant_id: table.tenant_id,
                  agent_id: agent.id,
                  title: taskTitle,
                  description: `${stoppedCampaigns.length} קמפיינים פעילים בחשבון "${table.name}" הפסיקו להוציא בימים האחרונים (3 ימים שלמים מול 7 ימים קודמים):\n\n${list}\n\nכדאי לבדוק שהתקציב והאשראי תקינים.`,
                  status: 'open',
                  priority: 2,
                  task_mode: 'anomaly_alert',
                });
              }
            }
          }
        } catch (zeroErr: any) {
          console.error(`[spend-drop] ${table.name}:`, zeroErr?.message);
        }

        // === Check report_alerts and trigger automations ===
        try {
          const { data: alerts } = await supabase
            .from('report_alerts')
            .select('*')
            .eq('table_id', table.id)
            .eq('tenant_id', table.tenant_id)
            .eq('is_active', true);

          if (alerts && alerts.length > 0) {

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


    // Auto-invoke next batch if there are more tables
    if (hasMore && !tableIds) {
      const nextOffset = batchOffset + BATCH_SIZE;
      console.log(`🔄 Triggering next batch at offset ${nextOffset}...`);
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      fetch(`${supabaseUrl}/functions/v1/cron-sync-facebook-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ batch_offset: nextOffset }),
      }).catch(err => console.error('Failed to trigger next batch:', err));
    }

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
