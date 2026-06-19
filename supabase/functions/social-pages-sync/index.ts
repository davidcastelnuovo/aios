// Syncs connected Facebook Pages (and their IG business accounts) into social_pages table.
// Stores per-page access tokens for content publishing.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function getUserToken(supabase: any, tenant_id: string): Promise<string | null> {
  let { data: integ } = await supabase
    .from('tenant_integrations')
    .select('api_key, shared_from_integration_id')
    .eq('tenant_id', tenant_id)
    .in('integration_type', ['facebook', 'facebook_lead_ads'])
    .eq('is_active', true).limit(1).maybeSingle();
  if (integ?.shared_from_integration_id && !integ?.api_key) {
    const { data: src } = await supabase.from('tenant_integrations').select('api_key')
      .eq('id', integ.shared_from_integration_id).eq('is_active', true).maybeSingle();
    if (src?.api_key) integ = { ...integ, api_key: src.api_key };
  }
  return integ?.api_key || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { tenant_id, client_id } = await req.json().catch(() => ({}));
    if (!tenant_id) return new Response(JSON.stringify({ error: 'tenant_id required' }), { status: 400, headers: corsHeaders });

    const userToken = await getUserToken(supabase, tenant_id);
    if (!userToken) return new Response(JSON.stringify({ error: 'fb_not_connected' }), { status: 400, headers: corsHeaders });

    // Fetch all pages with their PATs and IG business accounts
    const url = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,category,picture{url},instagram_business_account{id,username,profile_picture_url}&limit=100&access_token=${userToken}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j?.error) return new Response(JSON.stringify({ error: 'fb_api_error', fb_error: j.error }), { status: 400, headers: corsHeaders });

    const upserted: any[] = [];
    for (const p of j?.data || []) {
      // Facebook page
      const fbRow = {
        tenant_id, client_id: client_id || null,
        platform: 'facebook',
        page_id: p.id,
        page_name: p.name,
        page_access_token: p.access_token,
        category: p.category || null,
        picture_url: p.picture?.data?.url || null,
        ig_business_id: p.instagram_business_account?.id || null,
        is_active: true,
      };
      await supabase.from('social_pages').upsert(fbRow, { onConflict: 'tenant_id,platform,page_id' });
      upserted.push({ platform: 'facebook', page_id: p.id, name: p.name });

      // Linked Instagram business account
      if (p.instagram_business_account?.id) {
        const ig = p.instagram_business_account;
        const igRow = {
          tenant_id, client_id: client_id || null,
          platform: 'instagram',
          page_id: ig.id,
          page_name: ig.username || p.name,
          page_access_token: p.access_token, // IG API uses the FB Page token
          ig_business_id: ig.id,
          picture_url: ig.profile_picture_url || null,
          is_active: true,
        };
        await supabase.from('social_pages').upsert(igRow, { onConflict: 'tenant_id,platform,page_id' });
        upserted.push({ platform: 'instagram', page_id: ig.id, name: ig.username });
      }
    }
    return new Response(JSON.stringify({ success: true, count: upserted.length, pages: upserted }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
