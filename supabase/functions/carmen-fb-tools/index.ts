// Carmen FB Tools — single dispatcher for create/update/pause/resume/replace_lead_form on Meta.
// All write actions require confirmed=true. Approval gating is handled upstream by run-ai-agent
// via agent_approval_queue; this function performs the actual API call once approved.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const FB_VERSION = 'v21.0';

async function getFbToken(supabase: any, tenant_id: string): Promise<string | null> {
  let { data: integ } = await supabase
    .from('tenant_integrations')
    .select('api_key, shared_from_integration_id')
    .eq('tenant_id', tenant_id)
    .in('integration_type', ['facebook', 'facebook_lead_ads'])
    .eq('is_active', true)
    .limit(1).maybeSingle();
  if (integ?.shared_from_integration_id && !integ?.api_key) {
    const { data: src } = await supabase.from('tenant_integrations').select('api_key')
      .eq('id', integ.shared_from_integration_id).eq('is_active', true).maybeSingle();
    if (src?.api_key) integ = { ...integ, api_key: src.api_key };
  }
  return integ?.api_key || null;
}

async function getClientAdAccount(supabase: any, tenant_id: string, client_id: string): Promise<string | null> {
  const { data } = await supabase.from('clients').select('facebook_ad_account_id').eq('id', client_id).eq('tenant_id', tenant_id).maybeSingle();
  return data?.facebook_ad_account_id || null;
}

function err(message: string, status = 400, extra: any = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), { status, headers: corsHeaders });
}
function ok(payload: any) {
  return new Response(JSON.stringify({ success: true, ...payload }), { status: 200, headers: corsHeaders });
}

async function fbPost(path: string, params: Record<string, any>, token: string) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    body.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  body.set('access_token', token);
  const r = await fetch(`https://graph.facebook.com/${FB_VERSION}/${path}`, { method: 'POST', body });
  const json = await r.json();
  return { ok: r.ok && !json?.error, json };
}
async function fbGet(path: string, fields: string, token: string) {
  const r = await fetch(`https://graph.facebook.com/${FB_VERSION}/${path}?fields=${encodeURIComponent(fields)}&access_token=${token}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { tenant_id, action, confirmed } = body;

    if (!tenant_id || !action) return err('tenant_id and action required');
    if (!confirmed) return err('not_confirmed', 403, { message: 'דורש אישור מפורש (confirmed=true)' });

    const token = await getFbToken(supabase, tenant_id);
    if (!token) return err('fb_not_connected', 400);

    let result: any = {};

    switch (action) {
      case 'create_campaign': {
        const { client_id, name, objective = 'OUTCOME_LEADS', special_ad_categories = [], status = 'PAUSED', daily_budget } = body;
        if (!client_id || !name) return err('client_id, name required');
        const adAccount = await getClientAdAccount(supabase, tenant_id, client_id);
        if (!adAccount) return err('client_no_ad_account');
        const params: any = { name, objective, status, special_ad_categories };
        if (daily_budget != null) params.daily_budget = Math.round(Number(daily_budget) * 100);
        const r = await fbPost(`act_${adAccount.replace(/^act_/, '')}/campaigns`, params, token);
        if (!r.ok) return err('fb_api_error', 400, { fb_error: r.json?.error });
        result = { campaign_id: r.json.id, name, status, ad_account: adAccount };
        break;
      }
      case 'create_adset': {
        const { campaign_id, name, daily_budget, billing_event = 'IMPRESSIONS', optimization_goal = 'LEAD_GENERATION', targeting, start_time, end_time, status = 'PAUSED' } = body;
        if (!campaign_id || !name || !targeting) return err('campaign_id, name, targeting required');
        // resolve ad account from campaign
        const camp = await fbGet(campaign_id, 'account_id,name', token);
        if (camp?.error) return err('fb_api_error', 400, { fb_error: camp.error });
        const params: any = { name, campaign_id, billing_event, optimization_goal, targeting, status };
        if (daily_budget != null) params.daily_budget = Math.round(Number(daily_budget) * 100);
        if (start_time) params.start_time = start_time;
        if (end_time) params.end_time = end_time;
        const r = await fbPost(`act_${camp.account_id}/adsets`, params, token);
        if (!r.ok) return err('fb_api_error', 400, { fb_error: r.json?.error });
        result = { adset_id: r.json.id, campaign_id };
        break;
      }
      case 'create_ad': {
        const { adset_id, name, creative_id, status = 'PAUSED' } = body;
        if (!adset_id || !name || !creative_id) return err('adset_id, name, creative_id required');
        const adset = await fbGet(adset_id, 'account_id', token);
        if (adset?.error) return err('fb_api_error', 400, { fb_error: adset.error });
        const r = await fbPost(`act_${adset.account_id}/ads`, { name, adset_id, creative: { creative_id }, status }, token);
        if (!r.ok) return err('fb_api_error', 400, { fb_error: r.json?.error });
        result = { ad_id: r.json.id, adset_id };
        break;
      }
      case 'create_creative_from_media': {
        // Build a creative from a media row in marketing_media_library + page_id + link
        const { client_id, media_id, page_id, message, link, name, call_to_action_type = 'LEARN_MORE', lead_form_id } = body;
        if (!client_id || !media_id || !page_id || !message) return err('client_id, media_id, page_id, message required');
        const adAccount = await getClientAdAccount(supabase, tenant_id, client_id);
        if (!adAccount) return err('client_no_ad_account');
        const { data: media } = await supabase.from('marketing_media_library').select('bucket_path, mime_type').eq('id', media_id).eq('tenant_id', tenant_id).maybeSingle();
        if (!media) return err('media_not_found');
        if (!media.ad_ready && !/^image|^video/.test(media.mime_type)) return err('media_not_ad_ready');

        // Get signed URL to download from our bucket then upload to FB.
        const { data: signed } = await supabase.storage.from('carmen-media').createSignedUrl(media.bucket_path, 600);
        if (!signed?.signedUrl) return err('signed_url_failed');
        const fileRes = await fetch(signed.signedUrl);
        const blob = await fileRes.blob();

        const isVideo = String(media.mime_type).startsWith('video/');
        let imageHash: string | undefined;
        let videoId: string | undefined;
        if (isVideo) {
          const fd = new FormData();
          fd.append('access_token', token);
          fd.append('source', blob, 'video.mp4');
          const r = await fetch(`https://graph.facebook.com/${FB_VERSION}/act_${adAccount.replace(/^act_/, '')}/advideos`, { method: 'POST', body: fd });
          const j = await r.json();
          if (j?.error) return err('fb_video_upload_failed', 400, { fb_error: j.error });
          videoId = j.id;
        } else {
          const fd = new FormData();
          fd.append('access_token', token);
          fd.append('source', blob, 'image.' + (media.mime_type.split('/')[1] || 'jpg'));
          const r = await fetch(`https://graph.facebook.com/${FB_VERSION}/act_${adAccount.replace(/^act_/, '')}/adimages`, { method: 'POST', body: fd });
          const j = await r.json();
          if (j?.error) return err('fb_image_upload_failed', 400, { fb_error: j.error });
          const hashes = j?.images ? Object.values(j.images)[0] as any : null;
          imageHash = hashes?.hash;
        }

        const link_data: any = { message, link: link || `https://fb.me/${page_id}`, call_to_action: { type: call_to_action_type, value: lead_form_id ? { lead_gen_form_id: lead_form_id } : { link: link || `https://fb.me/${page_id}` } } };
        if (imageHash) link_data.image_hash = imageHash;
        const video_data: any = videoId ? { video_id: videoId, message, call_to_action: { type: call_to_action_type, value: lead_form_id ? { lead_gen_form_id: lead_form_id } : { link: link || `https://fb.me/${page_id}` } } } : null;

        const params: any = {
          name: name || `Carmen creative ${new Date().toISOString().slice(0, 10)}`,
          object_story_spec: video_data
            ? { page_id, video_data }
            : { page_id, link_data },
        };
        const r = await fbPost(`act_${adAccount.replace(/^act_/, '')}/adcreatives`, params, token);
        if (!r.ok) return err('fb_api_error', 400, { fb_error: r.json?.error });

        await supabase.from('marketing_media_library').update({ usage_count: (await supabase.from('marketing_media_library').select('usage_count').eq('id', media_id).single()).data?.usage_count + 1 || 1 }).eq('id', media_id);

        result = { creative_id: r.json.id, media_id, image_hash: imageHash, video_id: videoId };
        break;
      }
      case 'replace_lead_form': {
        const { ad_id, new_form_id } = body;
        if (!ad_id || !new_form_id) return err('ad_id, new_form_id required');
        const ad = await fbGet(ad_id, 'creative,account_id', token);
        if (ad?.error) return err('fb_api_error', 400, { fb_error: ad.error });
        const before = await fbGet(ad.creative.id, 'object_story_spec,name', token);
        const spec = before.object_story_spec || {};
        if (spec.link_data?.call_to_action) spec.link_data.call_to_action = { ...spec.link_data.call_to_action, value: { lead_gen_form_id: new_form_id } };
        if (spec.video_data?.call_to_action) spec.video_data.call_to_action = { ...spec.video_data.call_to_action, value: { lead_gen_form_id: new_form_id } };
        const r = await fbPost(`act_${ad.account_id}/adcreatives`, { name: (before.name || 'creative') + ' (form swap)', object_story_spec: spec }, token);
        if (!r.ok) return err('fb_api_error', 400, { fb_error: r.json?.error });
        const r2 = await fbPost(ad_id, { creative: { creative_id: r.json.id } }, token);
        if (!r2.ok) return err('fb_api_error', 400, { fb_error: r2.json?.error });
        result = { ad_id, new_creative_id: r.json.id, new_form_id };
        break;
      }
      case 'update_budget': {
        const { entity_id, daily_budget, lifetime_budget } = body;
        if (!entity_id) return err('entity_id required');
        const params: Record<string, any> = {};
        if (daily_budget != null) params.daily_budget = Math.round(Number(daily_budget) * 100);
        if (lifetime_budget != null) params.lifetime_budget = Math.round(Number(lifetime_budget) * 100);
        if (!Object.keys(params).length) return err('daily_budget or lifetime_budget required');
        const r = await fbPost(entity_id, params, token);
        if (!r.ok) return err('fb_api_error', 400, { fb_error: r.json?.error });
        result = { entity_id, ...params };
        break;
      }
      case 'pause':
      case 'resume': {
        const { entity_id } = body;
        if (!entity_id) return err('entity_id required');
        const status = action === 'pause' ? 'PAUSED' : 'ACTIVE';
        const r = await fbPost(entity_id, { status }, token);
        if (!r.ok) return err('fb_api_error', 400, { fb_error: r.json?.error });
        result = { entity_id, status };
        break;
      }
      default:
        return err('invalid_action', 400, { valid: ['create_campaign','create_adset','create_ad','create_creative_from_media','replace_lead_form','update_budget','pause','resume'] });
    }

    await supabase.from('agent_action_log').insert({
      tenant_id,
      action_type: `fb_${action}`,
      status: 'success',
      action_details: { request: body, result },
    }).then(() => {}, () => {});

    return ok({ action, ...result });
  } catch (e: any) {
    console.error('[carmen-fb-tools]', e);
    return err(String(e?.message || e), 500);
  }
});
