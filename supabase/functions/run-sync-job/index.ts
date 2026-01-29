import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

function formatPhoneForManyChat(phone: string): string {
  const cleaned = normalizePhone(phone);
  return `972${cleaned}`;
}

function getPhoneLookupCandidates(phone: string): string[] {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return [];
  const withCountry = `972${cleaned}`;
  return [`+${withCountry}`, withCountry, `0${cleaned}`, cleaned].filter(Boolean);
}

async function safeJson(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!contentType.includes('application/json')) {
    return { __nonJson: true, status: res.status, text: text.slice(0, 500) };
  }
  try {
    return JSON.parse(text);
  } catch (_e) {
    return { __parseError: true, status: res.status, text: text.slice(0, 500) };
  }
}

async function getPhoneNumberFieldId(
  apiKey: string,
  supabase: any,
  tenantId: string
): Promise<number | null> {
  const { data: integration } = await supabase
    .from('tenant_integrations')
    .select('settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'manychat')
    .single();

  const settings = (integration?.settings as Record<string, any>) || {};
  if (settings.phone_number_field_id) {
    return settings.phone_number_field_id;
  }

  const res = await fetch('https://api.manychat.com/fb/page/getCustomFields', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await safeJson(res);
  if (data?.status === 'success' && Array.isArray(data?.data)) {
    const phoneField = data.data.find((f: any) => f.name?.toLowerCase() === 'phone_number');
    if (phoneField?.id) {
      await supabase
        .from('tenant_integrations')
        .update({ settings: { ...settings, phone_number_field_id: phoneField.id } })
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'manychat');
      return phoneField.id;
    }
  }
  return null;
}

async function findSubscriberByPhone(apiKey: string, candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const url = `https://api.manychat.com/fb/subscriber/findBySystemField?phone=${encodeURIComponent(candidate)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    const data = await safeJson(res);
    if (data?.status === 'success' && data?.data?.id) {
      return String(data.data.id);
    }
  }
  return null;
}

async function findSubscriberByEmail(apiKey: string, email?: string | null): Promise<string | null> {
  if (!email) return null;
  const url = `https://api.manychat.com/fb/subscriber/findBySystemField?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    return null;
  }
  const data = await safeJson(res);
  if (data?.status === 'success' && data?.data?.id) {
    return String(data.data.id);
  }
  return null;
}

async function findSubscriberByCustomField(
  apiKey: string,
  fieldId: number,
  candidates: string[]
): Promise<string | null> {
  for (const candidate of candidates) {
    const url = `https://api.manychat.com/fb/subscriber/findByCustomField?field_id=${fieldId}&field_value=${encodeURIComponent(candidate)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    const data = await safeJson(res);
    if (data?.status === 'success' && data?.data?.id) {
      return String(data.data.id);
    }
  }
  return null;
}

async function setCustomField(
  apiKey: string,
  subscriberId: string,
  fieldId: number,
  value: string
): Promise<boolean> {
  const res = await fetch('https://api.manychat.com/fb/subscriber/setCustomField', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriber_id: subscriberId, field_id: fieldId, field_value: value }),
  });
  const data = await safeJson(res);
  return data?.status === 'success';
}

interface SyncResult {
  leadId: string;
  leadName: string;
  success: boolean;
  subscriberId?: string;
  error?: string;
  skipped?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if job should run
    if (job.status === 'stopped' || job.status === 'completed' || job.status === 'failed') {
      console.log(`Job ${jobId} is ${job.status}, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: `Job is ${job.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to running
    if (job.status === 'pending') {
      await supabase
        .from('sync_jobs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', jobId);
    }

    const tenantId = job.tenant_id;
    const settings = job.settings as { tagId?: number; delayMs?: number };
    const tagId = settings.tagId || 79380109;
    const delayMs = settings.delayMs || 10000;

    // Get ManyChat integration
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('api_key, is_active, settings')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manychat')
      .single();

    if (!integration?.api_key || !integration.is_active) {
      await supabase
        .from('sync_jobs')
        .update({ status: 'failed', error_message: 'ManyChat integration not found or inactive' })
        .eq('id', jobId);
      return new Response(
        JSON.stringify({ error: 'ManyChat integration not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = integration.api_key;
    const phoneFieldId = await getPhoneNumberFieldId(apiKey, supabase, tenantId);

    // Process leads in a loop until done or stopped
    let processedTotal = (job.progress as any)?.processed || 0;
    let failedTotal = (job.progress as any)?.failed || 0;
    let conflictsTotal = (job.progress as any)?.conflicts || 0;
    const totalLeads = (job.progress as any)?.total || 0;
    const allResults: SyncResult[] = ((job.progress as any)?.results || []).slice(-50); // Keep last 50 results

    while (true) {
      // Re-check job status (in case it was stopped)
      const { data: currentJob } = await supabase
        .from('sync_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (currentJob?.status === 'stopped') {
        console.log(`Job ${jobId} was stopped by user`);
        break;
      }

      // Fetch one lead
      const { data: leads } = await supabase
        .from('leads')
        .select('id, contact_name, phone, email, company_name')
        .eq('tenant_id', tenantId)
        .is('manychat_subscriber_id', null)
        .not('phone', 'is', null)
        .limit(1);

      if (!leads || leads.length === 0) {
        // No more leads
        console.log('No more leads to process');
        break;
      }

      const lead = leads[0];
      const formattedPhone = formatPhoneForManyChat(lead.phone);
      const phoneCandidates = getPhoneLookupCandidates(lead.phone);
      const leadName = lead.contact_name || lead.company_name || 'Unknown';

      console.log(`Processing lead ${lead.id}: ${leadName}`);

      let subscriberId: string | null = null;
      let wasSkipped = false;
      let errorMessage: string | null = null;

      try {
        // Find existing subscriber
        subscriberId = await findSubscriberByPhone(apiKey, phoneCandidates);
        if (!subscriberId) subscriberId = await findSubscriberByEmail(apiKey, lead.email);
        if (!subscriberId && phoneFieldId) {
          subscriberId = await findSubscriberByCustomField(apiKey, phoneFieldId, phoneCandidates);
        }

        // Create if not found
        if (!subscriberId) {
          const nameParts = (lead.contact_name || '').split(' ');
          const firstName = nameParts[0] || lead.company_name || 'Lead';
          const lastName = nameParts.slice(1).join(' ') || '';

          const createRes = await fetch('https://api.manychat.com/fb/subscriber/createSubscriber', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              first_name: firstName,
              last_name: lastName,
              phone: `+${formattedPhone}`,
              whatsapp_phone: `+${formattedPhone}`,
              email: lead.email || undefined,
              has_opt_in_sms: true,
              has_opt_in_email: !!lead.email,
              consent_phrase: 'אני מאשר קבלת הודעות',
            }),
          });

          const createData = await safeJson(createRes);
          if (createData.status === 'success' && createData.data?.id) {
            subscriberId = createData.data.id;
          } else if (JSON.stringify(createData).toLowerCase().includes('already exists')) {
            subscriberId = await findSubscriberByPhone(apiKey, phoneCandidates);
            if (!subscriberId) subscriberId = await findSubscriberByEmail(apiKey, lead.email);
            if (!subscriberId && phoneFieldId) {
              subscriberId = await findSubscriberByCustomField(apiKey, phoneFieldId, phoneCandidates);
            }
          }

          if (!subscriberId) {
            wasSkipped = true;
            errorMessage = `Could not create/find subscriber`;
            await supabase
              .from('leads')
              .update({ manychat_subscriber_id: 'SYNC_CONFLICT' })
              .eq('id', lead.id);
          }
        }

        // Set custom field and add tag
        if (subscriberId && !wasSkipped) {
          if (phoneFieldId) {
            await setCustomField(apiKey, subscriberId, phoneFieldId, `+${formattedPhone}`);
          }

          await fetch('https://api.manychat.com/fb/subscriber/addTag', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriber_id: subscriberId, tag_id: tagId }),
          });

          await supabase
            .from('leads')
            .update({ manychat_subscriber_id: subscriberId })
            .eq('id', lead.id);
        }
      } catch (err) {
        wasSkipped = true;
        errorMessage = err instanceof Error ? err.message : 'Unknown error';
      }

      // Update counters
      if (wasSkipped) {
        failedTotal++;
        conflictsTotal++;
      } else {
        processedTotal++;
      }

      // Add result
      allResults.push({
        leadId: lead.id,
        leadName,
        success: !wasSkipped,
        subscriberId: wasSkipped ? undefined : subscriberId || undefined,
        error: errorMessage || undefined,
        skipped: wasSkipped,
      });

      // Keep only last 50 results
      if (allResults.length > 50) {
        allResults.shift();
      }

      // Count remaining
      const { count: remainingCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('manychat_subscriber_id', null)
        .not('phone', 'is', null);

      const { count: conflictCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('manychat_subscriber_id', 'SYNC_CONFLICT');

      // Update job progress
      await supabase
        .from('sync_jobs')
        .update({
          progress: {
            processed: processedTotal,
            failed: failedTotal,
            remaining: remainingCount || 0,
            conflicts: conflictCount || 0,
            total: totalLeads,
            results: allResults,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      // If no more leads, we're done
      if (!remainingCount || remainingCount === 0) {
        break;
      }

      // Throttle
      console.log(`Waiting ${delayMs}ms before next lead...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }

    // Mark job as completed
    await supabase
      .from('sync_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`Job ${jobId} completed. Processed: ${processedTotal}, Failed: ${failedTotal}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedTotal,
        failed: failedTotal,
        conflicts: conflictsTotal,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Run sync job error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
