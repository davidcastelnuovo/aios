/**
 * resolve-meta-page-from-ad-account
 *
 * Given a Meta Ads account ID (e.g. "act_123456789"), resolves the Facebook
 * Page (and linked Instagram account) associated with it via the Meta Graph API.
 *
 * Strategy (in order of reliability):
 *  1. GET /{ad_account_id}?fields=promoted_object  → page_id directly on the account
 *  2. GET /{ad_account_id}/campaigns?fields=promoted_object&limit=10
 *     → page_id from the first campaign that has one
 *  3. GET /{ad_account_id}/adsets?fields=promoted_object&limit=10
 *     → page_id from the first ad set that has one
 *
 * Once a page_id is found:
 *  - Upsert into social_pages (facebook + instagram if linked)
 *  - Optionally update clients.meta_ads_account_id → social_pages link
 *
 * Request body:
 *  { tenant_id, client_id?, ad_account_id, auto_upsert?: boolean }
 *
 * Response:
 *  { page_id, page_name, ig_id?, ig_username?, source, upserted }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FB_VERSION = 'v21.0';
const FB_BASE = `https://graph.facebook.com/${FB_VERSION}`;

async function getFbToken(supabase: any, tenantId: string): Promise<string | null> {
  // Try own integration first, then shared
  let { data: integ } = await supabase
    .from('tenant_integrations')
    .select('api_key, shared_from_integration_id')
    .eq('tenant_id', tenantId)
    .in('integration_type', ['facebook', 'facebook_lead_ads'])
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (integ?.shared_from_integration_id && !integ?.api_key) {
    const { data: src } = await supabase
      .from('tenant_integrations')
      .select('api_key')
      .eq('id', integ.shared_from_integration_id)
      .eq('is_active', true)
      .maybeSingle();
    if (src?.api_key) integ = { ...integ, api_key: src.api_key };
  }
  return integ?.api_key ?? null;
}

async function fbGet(url: string) {
  const r = await fetch(url);
  const j = await r.json();
  if (j?.error) throw new Error(`Meta API error: ${j.error.message} (code ${j.error.code})`);
  return j;
}

/**
 * Try to find a page_id from the ad account using multiple strategies.
 * Returns { page_id, source } or null.
 */
async function resolvePageId(
  adAccountId: string,
  token: string,
): Promise<{ page_id: string; source: string } | null> {
  // Normalise: ensure "act_" prefix
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  // Strategy 1: promoted_object on the account itself
  try {
    const data = await fbGet(
      `${FB_BASE}/${accountId}?fields=promoted_object&access_token=${token}`,
    );
    if (data?.promoted_object?.page_id) {
      return { page_id: data.promoted_object.page_id, source: 'account.promoted_object' };
    }
  } catch (_) { /* fall through */ }

  // Strategy 2: campaigns promoted_object
  try {
    const data = await fbGet(
      `${FB_BASE}/${accountId}/campaigns?fields=promoted_object&limit=20&access_token=${token}`,
    );
    for (const c of data?.data ?? []) {
      if (c?.promoted_object?.page_id) {
        return { page_id: c.promoted_object.page_id, source: 'campaign.promoted_object' };
      }
    }
  } catch (_) { /* fall through */ }

  // Strategy 3: adsets promoted_object
  try {
    const data = await fbGet(
      `${FB_BASE}/${accountId}/adsets?fields=promoted_object&limit=20&access_token=${token}`,
    );
    for (const s of data?.data ?? []) {
      if (s?.promoted_object?.page_id) {
        return { page_id: s.promoted_object.page_id, source: 'adset.promoted_object' };
      }
    }
  } catch (_) { /* fall through */ }

  return null;
}

/**
 * Fetch page details + linked Instagram account.
 */
async function fetchPageDetails(pageId: string, token: string) {
  const data = await fbGet(
    `${FB_BASE}/${pageId}?fields=id,name,category,picture{url},instagram_business_account{id,username,profile_picture_url}&access_token=${token}`,
  );
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const { tenant_id, client_id, ad_account_id, auto_upsert = true } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!ad_account_id) {
      return new Response(JSON.stringify({ error: 'ad_account_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = await getFbToken(supabase, tenant_id);
    if (!token) {
      return new Response(JSON.stringify({ error: 'fb_not_connected', message: 'אינטגרציית פייסבוק לא מוגדרת' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve page_id
    const resolved = await resolvePageId(ad_account_id, token);
    if (!resolved) {
      return new Response(JSON.stringify({
        error: 'page_not_found',
        message: 'לא נמצא עמוד פייסבוק משויך לחשבון המודעות הזה',
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch full page details
    const pageDetails = await fetchPageDetails(resolved.page_id, token);
    const igAccount = pageDetails?.instagram_business_account;

    const result: Record<string, any> = {
      page_id: resolved.page_id,
      page_name: pageDetails?.name ?? null,
      category: pageDetails?.category ?? null,
      picture_url: pageDetails?.picture?.data?.url ?? null,
      ig_id: igAccount?.id ?? null,
      ig_username: igAccount?.username ?? null,
      source: resolved.source,
      upserted: false,
    };

    // Auto-upsert into social_pages
    if (auto_upsert) {
      // Facebook page
      const fbRow: Record<string, any> = {
        tenant_id,
        client_id: client_id ?? null,
        platform: 'facebook',
        page_id: resolved.page_id,
        page_name: pageDetails?.name ?? null,
        category: pageDetails?.category ?? null,
        picture_url: pageDetails?.picture?.data?.url ?? null,
        ig_business_id: igAccount?.id ?? null,
        is_active: true,
        metadata: { ad_account_id, resolved_via: resolved.source },
      };
      await supabase
        .from('social_pages')
        .upsert(fbRow, { onConflict: 'tenant_id,platform,page_id' });

      // Instagram account
      if (igAccount?.id) {
        const igRow: Record<string, any> = {
          tenant_id,
          client_id: client_id ?? null,
          platform: 'instagram',
          page_id: igAccount.id,
          page_name: igAccount.username ?? pageDetails?.name ?? null,
          picture_url: igAccount.profile_picture_url ?? null,
          ig_business_id: igAccount.id,
          is_active: true,
          metadata: { ad_account_id, resolved_via: resolved.source },
        };
        await supabase
          .from('social_pages')
          .upsert(igRow, { onConflict: 'tenant_id,platform,page_id' });
      }

      result.upserted = true;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('resolve-meta-page-from-ad-account error:', err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
