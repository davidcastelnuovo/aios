import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting meeting reminders check...');
    
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Calculate yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const results = {
      dayAfterReminders: [] as any[],
      sameDayReminders: [] as any[],
      errors: [] as string[],
    };

    // Part 1: Day after meeting set reminders
    // Find leads where meeting was set yesterday and reminder not sent
    console.log('Checking for day-after reminders...');
    console.log('Yesterday range:', yesterdayStart.toISOString(), 'to', yesterdayEnd.toISOString());
    
    const { data: dayAfterLeads, error: dayAfterError } = await supabase
      .from('leads')
      .select('id, company_name, contact_name, phone, tenant_id, meeting_date, meeting_time, meeting_location')
      .gte('meeting_set_date', yesterdayStart.toISOString())
      .lte('meeting_set_date', yesterdayEnd.toISOString())
      .is('meeting_reminder_day_after_sent_at', null);

    if (dayAfterError) {
      console.error('Error fetching day-after leads:', dayAfterError);
      results.errors.push(`Day-after query error: ${dayAfterError.message}`);
    } else if (dayAfterLeads && dayAfterLeads.length > 0) {
      console.log(`Found ${dayAfterLeads.length} leads for day-after reminders`);
      
      // Group by tenant
      const leadsByTenant: Record<string, typeof dayAfterLeads> = {};
      for (const lead of dayAfterLeads) {
        if (lead.tenant_id) {
          if (!leadsByTenant[lead.tenant_id]) {
            leadsByTenant[lead.tenant_id] = [];
          }
          leadsByTenant[lead.tenant_id].push(lead);
        }
      }

      // Trigger automations for each tenant
      for (const [tenantId, tenantLeads] of Object.entries(leadsByTenant)) {
        try {
          const payload = {
            trigger_type: 'meeting_day_after',
            tenant_id: tenantId,
            leads: tenantLeads.map(lead => ({
              lead_id: lead.id,
              company_name: lead.company_name,
              contact_name: lead.contact_name,
              phone: lead.phone,
              meeting_date: lead.meeting_date,
              meeting_time: lead.meeting_time,
              meeting_location: lead.meeting_location,
            })),
          };

          console.log(`Triggering meeting_day_after for tenant ${tenantId} with ${tenantLeads.length} leads`);

          const triggerResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify(payload),
          });

          const triggerResult = await triggerResponse.json();
          console.log('Trigger result:', triggerResult);

          // Mark as sent
          for (const lead of tenantLeads) {
            const { error: updateError } = await supabase
              .from('leads')
              .update({ meeting_reminder_day_after_sent_at: new Date().toISOString() })
              .eq('id', lead.id);

            if (updateError) {
              console.error(`Error updating lead ${lead.id}:`, updateError);
              results.errors.push(`Update error for lead ${lead.id}: ${updateError.message}`);
            } else {
              results.dayAfterReminders.push({
                lead_id: lead.id,
                company_name: lead.company_name,
              });
            }
          }
        } catch (err: unknown) {
          console.error(`Error processing tenant ${tenantId}:`, err);
          results.errors.push(`Tenant ${tenantId} error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } else {
      console.log('No leads found for day-after reminders');
    }

    // Part 2: Same day meeting reminders
    // Find leads where meeting is today and reminder not sent
    console.log('Checking for same-day reminders...');
    console.log('Today:', today);
    
    const { data: sameDayLeads, error: sameDayError } = await supabase
      .from('leads')
      .select('id, company_name, contact_name, phone, tenant_id, meeting_date, meeting_time, meeting_location')
      .eq('meeting_date', today)
      .is('meeting_reminder_same_day_sent_at', null);

    if (sameDayError) {
      console.error('Error fetching same-day leads:', sameDayError);
      results.errors.push(`Same-day query error: ${sameDayError.message}`);
    } else if (sameDayLeads && sameDayLeads.length > 0) {
      console.log(`Found ${sameDayLeads.length} leads for same-day reminders`);
      
      // Group by tenant
      const leadsByTenant: Record<string, typeof sameDayLeads> = {};
      for (const lead of sameDayLeads) {
        if (lead.tenant_id) {
          if (!leadsByTenant[lead.tenant_id]) {
            leadsByTenant[lead.tenant_id] = [];
          }
          leadsByTenant[lead.tenant_id].push(lead);
        }
      }

      // Trigger automations for each tenant
      for (const [tenantId, tenantLeads] of Object.entries(leadsByTenant)) {
        try {
          const payload = {
            trigger_type: 'meeting_same_day',
            tenant_id: tenantId,
            leads: tenantLeads.map(lead => ({
              lead_id: lead.id,
              company_name: lead.company_name,
              contact_name: lead.contact_name,
              phone: lead.phone,
              meeting_date: lead.meeting_date,
              meeting_time: lead.meeting_time,
              meeting_location: lead.meeting_location,
            })),
          };

          console.log(`Triggering meeting_same_day for tenant ${tenantId} with ${tenantLeads.length} leads`);

          const triggerResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify(payload),
          });

          const triggerResult = await triggerResponse.json();
          console.log('Trigger result:', triggerResult);

          // Mark as sent
          for (const lead of tenantLeads) {
            const { error: updateError } = await supabase
              .from('leads')
              .update({ meeting_reminder_same_day_sent_at: new Date().toISOString() })
              .eq('id', lead.id);

            if (updateError) {
              console.error(`Error updating lead ${lead.id}:`, updateError);
              results.errors.push(`Update error for lead ${lead.id}: ${updateError.message}`);
            } else {
              results.sameDayReminders.push({
                lead_id: lead.id,
                company_name: lead.company_name,
              });
            }
          }
        } catch (err: unknown) {
          console.error(`Error processing tenant ${tenantId}:`, err);
          results.errors.push(`Tenant ${tenantId} error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } else {
      console.log('No leads found for same-day reminders');
    }

    console.log('Meeting reminders check completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Meeting reminders check completed',
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in check-meeting-reminders:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
