import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/tiktok';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TIKTOK_API_KEY = Deno.env.get('TIKTOK_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!TIKTOK_API_KEY) throw new Error('TIKTOK_API_KEY not configured — TikTok connector not linked');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'No tenant' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch TikTok user info via gateway
    const fields = 'open_id,union_id,avatar_url,avatar_url_100,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count';
    const userInfoRes = await fetch(`${GATEWAY_URL}/user/info/?fields=${fields}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TIKTOK_API_KEY,
      },
    });

    const userInfoText = await userInfoRes.text();
    if (!userInfoRes.ok) {
      console.error('TikTok user/info failed', userInfoRes.status, userInfoText);
      return new Response(JSON.stringify({
        error: 'TikTok API error',
        status: userInfoRes.status,
        details: userInfoText,
      }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userInfo = JSON.parse(userInfoText);
    const tiktokUser = userInfo?.data?.user;
    if (!tiktokUser?.open_id) {
      return new Response(JSON.stringify({
        error: 'Could not read TikTok account',
        details: userInfo,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = {
      open_id: tiktokUser.open_id,
      union_id: tiktokUser.union_id,
      display_name: tiktokUser.display_name,
      avatar_url: tiktokUser.avatar_url_100 || tiktokUser.avatar_url,
      bio: tiktokUser.bio_description,
      profile_url: tiktokUser.profile_deep_link,
      is_verified: !!tiktokUser.is_verified,
      follower_count: tiktokUser.follower_count ?? 0,
      following_count: tiktokUser.following_count ?? 0,
      likes_count: tiktokUser.likes_count ?? 0,
      video_count: tiktokUser.video_count ?? 0,
      connected_at: new Date().toISOString(),
    };

    // Upsert tenant_integrations row
    const { data: existing } = await supabaseAdmin
      .from('tenant_integrations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'tiktok')
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('tenant_integrations')
        .update({ is_active: true, settings, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('tenant_integrations')
        .insert({
          tenant_id: tenantId,
          integration_type: 'tiktok',
          is_active: true,
          settings,
        });
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, account: settings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('tiktok-connect error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
