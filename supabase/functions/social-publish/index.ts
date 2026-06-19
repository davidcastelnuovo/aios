// Unified social publisher: posts text/image/video/reel/story to Facebook Page or Instagram.
// Body: { tenant_id, page_id (UUID of social_pages row), post_type, caption?, media_url?, link? }
// post_type: 'post' | 'photo' | 'video' | 'reel' | 'story' | 'link'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const GRAPH = 'https://graph.facebook.com/v21.0';

async function publishFacebook(page: any, post_type: string, caption?: string, media_url?: string, link?: string) {
  const token = page.page_access_token;
  if (post_type === 'post' || post_type === 'link') {
    const params = new URLSearchParams({ access_token: token });
    if (caption) params.set('message', caption);
    if (link) params.set('link', link);
    const r = await fetch(`${GRAPH}/${page.page_id}/feed`, { method: 'POST', body: params });
    return await r.json();
  }
  if (post_type === 'photo') {
    if (!media_url) throw new Error('media_url required for photo');
    const params = new URLSearchParams({ access_token: token, url: media_url });
    if (caption) params.set('caption', caption);
    const r = await fetch(`${GRAPH}/${page.page_id}/photos`, { method: 'POST', body: params });
    return await r.json();
  }
  if (post_type === 'video') {
    if (!media_url) throw new Error('media_url required for video');
    const params = new URLSearchParams({ access_token: token, file_url: media_url });
    if (caption) params.set('description', caption);
    const r = await fetch(`${GRAPH}/${page.page_id}/videos`, { method: 'POST', body: params });
    return await r.json();
  }
  if (post_type === 'reel') {
    if (!media_url) throw new Error('media_url required for reel');
    // Step 1: start upload session
    const start = await fetch(`${GRAPH}/${page.page_id}/video_reels`, {
      method: 'POST',
      body: new URLSearchParams({ upload_phase: 'start', access_token: token }),
    });
    const startJ = await start.json();
    if (startJ?.error) throw new Error(JSON.stringify(startJ.error));
    const videoId = startJ.video_id;
    const uploadUrl = startJ.upload_url;
    // Step 2: hosted upload (FB pulls from URL)
    const upRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `OAuth ${token}`, file_url: media_url },
    });
    const upJ = await upRes.json().catch(() => ({}));
    if ((upJ as any)?.error) throw new Error(JSON.stringify((upJ as any).error));
    // Step 3: finish & publish
    const fin = await fetch(`${GRAPH}/${page.page_id}/video_reels?upload_phase=finish&video_id=${videoId}&video_state=PUBLISHED&description=${encodeURIComponent(caption || '')}&access_token=${token}`, { method: 'POST' });
    return { ...(await fin.json()), id: videoId };
  }
  if (post_type === 'story') {
    if (!media_url) throw new Error('media_url required for story');
    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(media_url);
    const endpoint = isVideo ? 'video_stories' : 'photo_stories';
    if (!isVideo) {
      // For photo stories: first upload photo unpublished, then publish as story
      const ph = await fetch(`${GRAPH}/${page.page_id}/photos`, {
        method: 'POST', body: new URLSearchParams({ access_token: token, url: media_url, published: 'false' }),
      });
      const phJ = await ph.json();
      if (phJ?.error) throw new Error(JSON.stringify(phJ.error));
      const r = await fetch(`${GRAPH}/${page.page_id}/${endpoint}`, {
        method: 'POST', body: new URLSearchParams({ access_token: token, photo_id: phJ.id }),
      });
      return await r.json();
    } else {
      // Video story: similar to reel resumable
      const start = await fetch(`${GRAPH}/${page.page_id}/${endpoint}`, {
        method: 'POST', body: new URLSearchParams({ upload_phase: 'start', access_token: token }),
      });
      const startJ = await start.json();
      if (startJ?.error) throw new Error(JSON.stringify(startJ.error));
      await fetch(startJ.upload_url, { method: 'POST', headers: { Authorization: `OAuth ${token}`, file_url: media_url } });
      const fin = await fetch(`${GRAPH}/${page.page_id}/${endpoint}?upload_phase=finish&video_id=${startJ.video_id}&access_token=${token}`, { method: 'POST' });
      return { ...(await fin.json()), id: startJ.video_id };
    }
  }
  throw new Error('unsupported post_type');
}

async function publishInstagram(page: any, post_type: string, caption?: string, media_url?: string) {
  const token = page.page_access_token;
  const igId = page.ig_business_id || page.page_id;
  if (!media_url && post_type !== 'post') throw new Error('media_url required for IG');

  // Step 1: create container
  const params = new URLSearchParams({ access_token: token });
  if (caption) params.set('caption', caption);
  if (post_type === 'reel') {
    params.set('media_type', 'REELS'); params.set('video_url', media_url!);
  } else if (post_type === 'video') {
    params.set('media_type', 'VIDEO'); params.set('video_url', media_url!);
  } else if (post_type === 'story') {
    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(media_url!);
    params.set('media_type', isVideo ? 'STORIES' : 'STORIES');
    if (isVideo) params.set('video_url', media_url!); else params.set('image_url', media_url!);
  } else {
    // photo/post
    params.set('image_url', media_url!);
  }
  const c = await fetch(`${GRAPH}/${igId}/media`, { method: 'POST', body: params });
  const cJ = await c.json();
  if (cJ?.error) throw new Error(JSON.stringify(cJ.error));
  const containerId = cJ.id;

  // Step 2: poll status until finished (videos take time)
  if (['reel', 'video', 'story'].includes(post_type) && /\.(mp4|mov|webm)(\?|$)/i.test(media_url!)) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const s = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${token}`);
      const sJ = await s.json();
      if (sJ.status_code === 'FINISHED') break;
      if (sJ.status_code === 'ERROR') throw new Error('IG media processing failed');
    }
  }

  // Step 3: publish
  const pub = await fetch(`${GRAPH}/${igId}/media_publish`, {
    method: 'POST', body: new URLSearchParams({ creation_id: containerId, access_token: token }),
  });
  return await pub.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { tenant_id, page_id, post_type, caption, media_url, link, client_id } = body;
    if (!tenant_id || !page_id || !post_type) {
      return new Response(JSON.stringify({ error: 'tenant_id, page_id, post_type required' }), { status: 400, headers: corsHeaders });
    }

    const { data: page } = await supabase.from('social_pages').select('*').eq('id', page_id).eq('tenant_id', tenant_id).maybeSingle();
    if (!page) return new Response(JSON.stringify({ error: 'page_not_found' }), { status: 404, headers: corsHeaders });
    if (!page.page_access_token) return new Response(JSON.stringify({ error: 'page_token_missing — run social-pages-sync first' }), { status: 400, headers: corsHeaders });

    // Insert pending publication
    const { data: pub } = await supabase.from('social_publications').insert({
      tenant_id, client_id: client_id || page.client_id, page_id, platform: page.platform,
      post_type, caption, media_url, status: 'processing',
    }).select('id').single();

    try {
      const result = page.platform === 'instagram'
        ? await publishInstagram(page, post_type, caption, media_url)
        : await publishFacebook(page, post_type, caption, media_url, link);

      if ((result as any)?.error) throw new Error(JSON.stringify((result as any).error));
      const externalId = (result as any).id || (result as any).post_id;
      const permalink = page.platform === 'facebook'
        ? `https://www.facebook.com/${externalId}`
        : null;
      await supabase.from('social_publications').update({
        status: 'published', external_id: externalId, permalink, published_at: new Date().toISOString(),
      }).eq('id', pub!.id);
      return new Response(JSON.stringify({ success: true, publication_id: pub!.id, external_id: externalId, result }), { headers: corsHeaders });
    } catch (publishErr: any) {
      await supabase.from('social_publications').update({
        status: 'failed', error_message: String(publishErr?.message || publishErr),
      }).eq('id', pub!.id);
      return new Response(JSON.stringify({ error: 'publish_failed', message: String(publishErr?.message || publishErr) }), { status: 400, headers: corsHeaders });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
