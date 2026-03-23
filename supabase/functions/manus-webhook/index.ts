import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp',
};

// Cache for Manus public key
let cachedPublicKey: string | null = null;
let publicKeyFetchedAt = 0;
const PUBLIC_KEY_CACHE_DURATION = 3600000; // 1 hour

async function getManusPublicKey(): Promise<string | null> {
  const now = Date.now();
  if (cachedPublicKey && (now - publicKeyFetchedAt) < PUBLIC_KEY_CACHE_DURATION) {
    return cachedPublicKey;
  }

  try {
    const res = await fetch('https://api.manus.ai/v1/webhook/public_key');
    if (!res.ok) {
      console.error('Failed to fetch Manus public key:', res.status);
      return cachedPublicKey; // Return stale cache if available
    }
    const data = await res.json();
    cachedPublicKey = data.public_key;
    publicKeyFetchedAt = now;
    return cachedPublicKey;
  } catch (err) {
    console.error('Error fetching Manus public key:', err);
    return cachedPublicKey;
  }
}

async function verifySignature(
  publicKeyPem: string,
  url: string,
  body: Uint8Array,
  signatureB64: string,
  timestamp: string
): Promise<boolean> {
  try {
    // Check timestamp freshness (5 min window)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    if (Math.abs(currentTime - requestTime) > 300) {
      console.error('Webhook timestamp outside acceptable range');
      return false;
    }

    // Compute body SHA256 hex
    const bodyHash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', body))
    ).map(b => b.toString(16).padStart(2, '0')).join('');

    // Construct signature content
    const signatureContent = new TextEncoder().encode(`${timestamp}.${url}.${bodyHash}`);

    // Hash the content
    const contentHash = await crypto.subtle.digest('SHA-256', signatureContent);

    // Import public key
    const pemBody = publicKeyPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    const binaryDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'spki',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode signature
    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));

    // Verify
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signature,
      contentHash
    );
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = req.url;
    const rawBody = new Uint8Array(await req.arrayBuffer());
    const bodyText = new TextDecoder().decode(rawBody);

    // Verify webhook signature if headers present
    const signature = req.headers.get('x-webhook-signature');
    const timestamp = req.headers.get('x-webhook-timestamp');

    if (signature && timestamp) {
      const publicKey = await getManusPublicKey();
      if (publicKey) {
        const valid = await verifySignature(publicKey, url, rawBody, signature, timestamp);
        if (!valid) {
          console.error('Invalid webhook signature');
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const payload = JSON.parse(bodyText);
    console.log('Manus webhook received:', JSON.stringify(payload).substring(0, 500));

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Extract task info from payload
    const taskId = payload.task_id || payload.id;
    const status = payload.status;
    const output = payload.output;
    const creditUsage = payload.credit_usage;
    const taskTitle = payload.metadata?.task_title || payload.task_title;

    if (taskId) {
      // Update our local task record
      const updateData: any = { updated_at: new Date().toISOString() };
      if (status) updateData.status = status;
      if (output) updateData.output = output;
      if (creditUsage !== undefined) updateData.credit_usage = creditUsage;
      if (taskTitle) updateData.title = taskTitle;

      const { error: updateError } = await supabaseClient
        .from('manus_tasks')
        .update(updateData)
        .eq('task_id', taskId);

      if (updateError) {
        console.error('Failed to update manus task:', updateError);
      } else {
        console.log(`Updated manus task ${taskId} with status: ${status}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Manus webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
