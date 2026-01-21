import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhoneIsraelToE164(phoneRaw: string): string | null {
  if (!phoneRaw) return null;

  const trimmed = phoneRaw.trim();
  if (!trimmed) return null;

  // Keep non-Israeli E.164 as-is (normalize to +digits)
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    return digits ? `+${digits}` : null;
  }

  // 00 prefix -> +
  if (trimmed.startsWith('00')) {
    const digits = trimmed.replace(/\D/g, '');
    const without00 = digits.startsWith('00') ? digits.slice(2) : digits;
    return without00 ? `+${without00}` : null;
  }

  // Israel heuristics
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  // Remove leading country code 972 if present
  if (digits.startsWith('972')) {
    digits = digits.slice(3);
  }
  // Remove leading 0 if present
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Most Israeli numbers after removing 0 are 8-9 digits (landline/mobile)
  if (digits.length < 8 || digits.length > 9) {
    return null;
  }

  return `+972${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tenantId, limit = 2000, dryRun = false } = await req.json();
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Missing tenantId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch leads with a phone
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, phone')
      .eq('tenant_id', tenantId)
      .not('phone', 'is', null)
      .limit(limit);

    if (leadsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch leads', details: leadsError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updates: Array<{ id: string; phone: string | null; original: string | null; normalized: string | null; changed: boolean; reason?: string }> = [];
    let changedCount = 0;
    let invalidCount = 0;

    for (const lead of leads || []) {
      const original = (lead.phone ?? '').toString();
      const normalized = normalizePhoneIsraelToE164(original);
      const changed = normalized !== null && normalized !== original;

      if (changed) changedCount++;
      if (!normalized) invalidCount++;

      updates.push({
        id: lead.id,
        phone: normalized,
        original: original || null,
        normalized,
        changed,
        reason: normalized ? undefined : 'unrecognized_format',
      });
    }

    if (!dryRun) {
      for (const u of updates) {
        if (!u.changed) continue;
        const { error: updateError } = await supabase
          .from('leads')
          .update({ phone: u.phone })
          .eq('id', u.id)
          .eq('tenant_id', tenantId);

        if (updateError) {
          // continue but record failure
          console.error('Failed updating lead phone:', u.id, updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenantId,
        scanned: (leads || []).length,
        changed: changedCount,
        invalid: invalidCount,
        dryRun,
        sample: updates.slice(0, 25),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('normalize-lead-phones error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
