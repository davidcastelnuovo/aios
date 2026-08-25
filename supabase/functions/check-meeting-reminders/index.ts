import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendCrmWhatsappToLeadAdmin } from '../_shared/crm-whatsapp-send.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReminderLead = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  tenant_id: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_location: string | null;
};

function sameDayMessage(lead: ReminderLead): string {
  const name = lead.contact_name || lead.company_name || '';
  const hello = name ? `היי ${name}, ` : '';
  const time = lead.meeting_time || '';
  const where = lead.meeting_location ? ` (${lead.meeting_location})` : '';
  return `${hello}תזכורת: היום יש לך פגישה בשעה ${time}${where}.`.trim();
}

function dayAfterMessage(lead: ReminderLead): string {
  const name = lead.contact_name || lead.company_name || '';
  const hello = name ? `היי ${name}, ` : '';
  const when = [lead.meeting_date, lead.meeting_time].filter(Boolean).join(' ');
  const where = lead.meeting_location ? ` (${lead.meeting_location})` : '';
  return `${hello}תזכורת: נקבעה לך פגישה ל-${when}${where}.`.trim();
}

async function processTenantReminders(opts: {
  supabase: ReturnType<typeof createClient>;
  supabaseUrl: string;
  serviceKey: string;
  tenantId: string;
  leads: ReminderLead[];
  triggerType: 'meeting_same_day' | 'meeting_day_after';
  sentColumn: 'meeting_reminder_same_day_sent_at' | 'meeting_reminder_day_after_sent_at';
  messageFor: (lead: ReminderLead) => string;
  results: { lead_id: string; company_name: string | null; via: string }[];
  errors: string[];
}) {
  const fallbackLeads: ReminderLead[] = [];

  for (const lead of opts.leads) {
    const wa = await sendCrmWhatsappToLeadAdmin({
      admin: opts.supabase,
      supabaseUrl: opts.supabaseUrl,
      serviceKey: opts.serviceKey,
      leadId: lead.id,
      message: opts.messageFor(lead),
    });
    if (wa.ok) {
      const { error: updateError } = await opts.supabase
        .from('leads')
        .update({ [opts.sentColumn]: new Date().toISOString() })
        .eq('id', lead.id);
      if (updateError) {
        opts.errors.push(`Update error for lead ${lead.id}: ${updateError.message}`);
      } else {
        opts.results.push({
          lead_id: lead.id,
          company_name: lead.company_name,
          via: 'crm_whatsapp',
        });
      }
    } else {
      if (wa.error) opts.errors.push(`CRM WA ${lead.id}: ${wa.error}`);
      fallbackLeads.push(lead);
    }
  }

  if (fallbackLeads.length === 0) return;

  const payload = {
    trigger_type: opts.triggerType,
    tenant_id: opts.tenantId,
    leads: fallbackLeads.map((lead) => ({
      lead_id: lead.id,
      company_name: lead.company_name,
      contact_name: lead.contact_name,
      phone: lead.phone,
      meeting_date: lead.meeting_date,
      meeting_time: lead.meeting_time,
      meeting_location: lead.meeting_location,
    })),
  };

  const triggerResponse = await fetch(`${opts.supabaseUrl}/functions/v1/trigger-automation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.serviceKey}`,
    },
    body: JSON.stringify(payload),
  });
  await triggerResponse.json().catch(() => ({}));

  for (const lead of fallbackLeads) {
    const { error: updateError } = await opts.supabase
      .from('leads')
      .update({ [opts.sentColumn]: new Date().toISOString() })
      .eq('id', lead.id);
    if (updateError) {
      opts.errors.push(`Update error for lead ${lead.id}: ${updateError.message}`);
    } else {
      opts.results.push({
        lead_id: lead.id,
        company_name: lead.company_name,
        via: 'automation',
      });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const results = {
      dayAfterReminders: [] as { lead_id: string; company_name: string | null; via: string }[],
      sameDayReminders: [] as { lead_id: string; company_name: string | null; via: string }[],
      errors: [] as string[],
    };

    const { data: dayAfterLeads, error: dayAfterError } = await supabase
      .from('leads')
      .select('id, company_name, contact_name, phone, tenant_id, meeting_date, meeting_time, meeting_location')
      .gte('meeting_set_date', yesterdayStart.toISOString())
      .lte('meeting_set_date', yesterdayEnd.toISOString())
      .is('meeting_reminder_day_after_sent_at', null)
      .neq('meeting_date', today);

    if (dayAfterError) {
      results.errors.push(`Day-after query error: ${dayAfterError.message}`);
    } else if (dayAfterLeads && dayAfterLeads.length > 0) {
      const leadsByTenant: Record<string, ReminderLead[]> = {};
      for (const lead of dayAfterLeads as ReminderLead[]) {
        if (!lead.tenant_id) continue;
        if (!leadsByTenant[lead.tenant_id]) leadsByTenant[lead.tenant_id] = [];
        leadsByTenant[lead.tenant_id].push(lead);
      }
      for (const [tenantId, tenantLeads] of Object.entries(leadsByTenant)) {
        try {
          await processTenantReminders({
            supabase,
            supabaseUrl,
            serviceKey: supabaseServiceKey,
            tenantId,
            leads: tenantLeads,
            triggerType: 'meeting_day_after',
            sentColumn: 'meeting_reminder_day_after_sent_at',
            messageFor: dayAfterMessage,
            results: results.dayAfterReminders,
            errors: results.errors,
          });
        } catch (err: unknown) {
          results.errors.push(`Tenant ${tenantId} error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    const { data: sameDayLeads, error: sameDayError } = await supabase
      .from('leads')
      .select('id, company_name, contact_name, phone, tenant_id, meeting_date, meeting_time, meeting_location')
      .eq('meeting_date', today)
      .is('meeting_reminder_same_day_sent_at', null);

    if (sameDayError) {
      results.errors.push(`Same-day query error: ${sameDayError.message}`);
    } else if (sameDayLeads && sameDayLeads.length > 0) {
      const leadsByTenant: Record<string, ReminderLead[]> = {};
      for (const lead of sameDayLeads as ReminderLead[]) {
        if (!lead.tenant_id) continue;
        if (!leadsByTenant[lead.tenant_id]) leadsByTenant[lead.tenant_id] = [];
        leadsByTenant[lead.tenant_id].push(lead);
      }
      for (const [tenantId, tenantLeads] of Object.entries(leadsByTenant)) {
        try {
          await processTenantReminders({
            supabase,
            supabaseUrl,
            serviceKey: supabaseServiceKey,
            tenantId,
            leads: tenantLeads,
            triggerType: 'meeting_same_day',
            sentColumn: 'meeting_reminder_same_day_sent_at',
            messageFor: sameDayMessage,
            results: results.sameDayReminders,
            errors: results.errors,
          });
        } catch (err: unknown) {
          results.errors.push(`Tenant ${tenantId} error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Meeting reminders check completed',
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('Error in check-meeting-reminders:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
