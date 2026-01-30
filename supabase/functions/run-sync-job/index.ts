import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Edge functions have execution time limits. Running a long sync (minutes) in a single invocation
// will be terminated mid-way. We therefore process in small batches and self-invoke until done.
const MAX_RUNTIME_MS = 25_000; // keep a safety margin under common 30s limits
const DEFAULT_BATCH_SIZE = 20;
const RUNNING_STALE_AFTER_MS = 60_000; // if no heartbeat/progress update for 60s, we can resume

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

async function triggerNextRun(
  supabaseUrl: string,
  supabaseServiceKey: string,
  jobId: string
): Promise<void> {
  const runUrl = `${supabaseUrl}/functions/v1/run-sync-job`;
  fetch(runUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ jobId }),
  }).catch((err) => {
    console.error('Failed to trigger next run-sync-job:', err);
  });
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

    // Prevent overlapping runners (can happen if the function is triggered multiple times).
    // If the job is already running and has recent updates, we assume another runner is active.
    const jobUpdatedAt = job.updated_at ? new Date(job.updated_at).getTime() : 0;
    const nowMs = Date.now();
    const isFreshRunning =
      job.status === 'running' && jobUpdatedAt > 0 && nowMs - jobUpdatedAt < RUNNING_STALE_AFTER_MS;

    // Internal self-invocations (using the service role key) MUST be allowed.
    // Otherwise, the "batch + self-trigger" pattern stops after the first chunk.
    const authHeader = req.headers.get('Authorization') || '';
    const isInternalServiceCall = authHeader === `Bearer ${supabaseServiceKey}`;

    if (isFreshRunning && !isInternalServiceCall) {
      console.log(`Job ${jobId} is already running (fresh heartbeat), skipping this trigger`);
      return new Response(
        JSON.stringify({ success: true, message: 'Job already running' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to running (and refresh heartbeat)
    if (job.status === 'pending') {
      await supabase
        .from('sync_jobs')
        .update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', jobId);
    } else {
      // stale runner recovery: mark a heartbeat so UI shows it's alive again
      await supabase
        .from('sync_jobs')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', jobId);
    }

    const tenantId = job.tenant_id;
    const settings = job.settings as { tagId?: number; delayMs?: number };
    const tagId = settings.tagId || 79380109;
    const delayMs = settings.delayMs || 1000;
    const batchSize = (job.settings as any)?.batchSize ?? DEFAULT_BATCH_SIZE;

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

    const startedAtMs = Date.now();
    let processedThisRun = 0;

    // Process leads in a loop until done/stopped OR we hit our batch/runtime limits
    let processedTotal = (job.progress as any)?.processed || 0;
    let failedTotal = (job.progress as any)?.failed || 0;
    let conflictsTotal = (job.progress as any)?.conflicts || 0;
    const totalLeads = (job.progress as any)?.total || 0;
    const allResults: SyncResult[] = ((job.progress as any)?.results || []).slice(-50); // Keep last 50 results

     while (true) {
       // Stop if we are close to runtime limits
       if (Date.now() - startedAtMs > MAX_RUNTIME_MS) {
         console.log(`Runtime limit reached for job ${jobId} - will continue in next invocation`);
         break;
       }

       // Stop if we processed enough in this run
       if (processedThisRun >= batchSize) {
         console.log(`Batch limit reached for job ${jobId} (${batchSize}) - will continue in next invocation`);
         break;
       }

      // Re-check job status (in case it was stopped/failed by user)
      const { data: currentJob } = await supabase
        .from('sync_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (currentJob?.status === 'stopped' || currentJob?.status === 'failed') {
        console.log(`Job ${jobId} was stopped/cancelled by user (status: ${currentJob?.status})`);
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

        // Avoid infinite retries on a lead that keeps failing: mark it as needing manual attention.
        // (Keeps the job moving instead of getting stuck repeatedly on the same bad record.)
        try {
          await supabase
            .from('leads')
            .update({ manychat_subscriber_id: 'NEEDS_MANUAL_LINK' })
            .eq('id', lead.id);
        } catch (updateErr) {
          console.error('Failed to mark lead as NEEDS_MANUAL_LINK:', updateErr);
        }
      }

      // Update counters
      if (wasSkipped) {
        failedTotal++;
        conflictsTotal++;
      } else {
        processedTotal++;
      }

       processedThisRun++;

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

    // Re-check job status BEFORE deciding whether to continue
    const { data: finalJobStatus } = await supabase
      .from('sync_jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    // If job was stopped/failed by user, do NOT continue
    if (finalJobStatus?.status === 'stopped' || finalJobStatus?.status === 'failed') {
      console.log(`Job ${jobId} was stopped by user, not continuing.`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Job stopped by user',
          processed: processedTotal,
          failed: failedTotal,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if anything remains; if yes, self-invoke again. If not, complete.
    const { count: remainingAfter } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('manychat_subscriber_id', null)
      .not('phone', 'is', null);

    if (remainingAfter && remainingAfter > 0) {
      console.log(`Job ${jobId} continuing. Remaining: ${remainingAfter}`);
      // Keep status running and schedule next chunk
      await supabase
        .from('sync_jobs')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', jobId);

      await triggerNextRun(supabaseUrl, supabaseServiceKey, jobId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Continuing in background',
          processed: processedTotal,
          failed: failedTotal,
          remaining: remainingAfter,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark job as completed
    await supabase
      .from('sync_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
