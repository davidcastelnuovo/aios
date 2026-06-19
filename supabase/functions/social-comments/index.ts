// Social comments management:
// action='fetch' — pulls latest comments for a page's recent posts and upserts to social_comments
// action='reply' — posts a reply to a specific comment
// action='hide' — hides a comment
// action='delete' — deletes our own comment
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const GRAPH = 'https://graph.facebook.com/v21.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { action, tenant_id, page_id, external_comment_id, message, comment_row_id } = body;
    if (!action || !tenant_id) return new Response(JSON.stringify({ error: 'action, tenant_id required' }), { status: 400, headers: corsHeaders });

    if (action === 'fetch') {
      if (!page_id) return new Response(JSON.stringify({ error: 'page_id required' }), { status: 400, headers: corsHeaders });
      const { data: page } = await supabase.from('social_pages').select('*').eq('id', page_id).eq('tenant_id', tenant_id).maybeSingle();
      if (!page) return new Response(JSON.stringify({ error: 'page_not_found' }), { status: 404, headers: corsHeaders });
      const token = page.page_access_token;

      let count = 0;
      if (page.platform === 'facebook') {
        // Recent posts → their comments
        const postsR = await fetch(`${GRAPH}/${page.page_id}/posts?fields=id,message,created_time&limit=20&access_token=${token}`);
        const postsJ = await postsR.json();
        if (postsJ?.error) return new Response(JSON.stringify({ error: 'fb_api_error', fb_error: postsJ.error }), { status: 400, headers: corsHeaders });
        for (const post of postsJ?.data || []) {
          const cR = await fetch(`${GRAPH}/${post.id}/comments?fields=id,from,message,created_time,parent,is_hidden&limit=100&access_token=${token}`);
          const cJ = await cR.json();
          for (const c of cJ?.data || []) {
            await supabase.from('social_comments').upsert({
              tenant_id, page_id: page.id, client_id: page.client_id,
              platform: 'facebook',
              external_comment_id: c.id,
              external_post_id: post.id,
              parent_comment_id: c.parent?.id || null,
              author_id: c.from?.id || null,
              author_name: c.from?.name || 'Anonymous',
              message: c.message || '',
              is_from_page: c.from?.id === page.page_id,
              hidden_at: c.is_hidden ? new Date().toISOString() : null,
              created_at_external: c.created_time ? new Date(c.created_time).toISOString() : null,
            }, { onConflict: 'platform,external_comment_id' });
            count++;
          }
        }
      } else if (page.platform === 'instagram') {
        const igId = page.ig_business_id || page.page_id;
        const mediaR = await fetch(`${GRAPH}/${igId}/media?fields=id,caption,timestamp&limit=20&access_token=${token}`);
        const mediaJ = await mediaR.json();
        for (const m of mediaJ?.data || []) {
          const cR = await fetch(`${GRAPH}/${m.id}/comments?fields=id,username,text,timestamp,parent_id,hidden&limit=50&access_token=${token}`);
          const cJ = await cR.json();
          for (const c of cJ?.data || []) {
            await supabase.from('social_comments').upsert({
              tenant_id, page_id: page.id, client_id: page.client_id,
              platform: 'instagram',
              external_comment_id: c.id,
              external_post_id: m.id,
              parent_comment_id: c.parent_id || null,
              author_name: c.username || 'Unknown',
              message: c.text || '',
              hidden_at: c.hidden ? new Date().toISOString() : null,
              created_at_external: c.timestamp ? new Date(c.timestamp).toISOString() : null,
            }, { onConflict: 'platform,external_comment_id' });
            count++;
          }
        }
      }
      return new Response(JSON.stringify({ success: true, fetched: count }), { headers: corsHeaders });
    }

    // For reply/hide/delete we need the comment row + its page token
    if (!comment_row_id && !external_comment_id) {
      return new Response(JSON.stringify({ error: 'comment_row_id or external_comment_id required' }), { status: 400, headers: corsHeaders });
    }
    let q = supabase.from('social_comments').select('*, social_pages!inner(page_access_token, platform, page_id)').eq('tenant_id', tenant_id);
    if (comment_row_id) q = q.eq('id', comment_row_id); else q = q.eq('external_comment_id', external_comment_id);
    const { data: comment } = await q.maybeSingle();
    if (!comment) return new Response(JSON.stringify({ error: 'comment_not_found' }), { status: 404, headers: corsHeaders });
    const token = (comment as any).social_pages.page_access_token;

    if (action === 'reply') {
      if (!message) return new Response(JSON.stringify({ error: 'message required' }), { status: 400, headers: corsHeaders });
      const r = await fetch(`${GRAPH}/${comment.external_comment_id}/comments`, {
        method: 'POST', body: new URLSearchParams({ message, access_token: token }),
      });
      const j = await r.json();
      if (j?.error) return new Response(JSON.stringify({ error: 'fb_api_error', fb_error: j.error }), { status: 400, headers: corsHeaders });
      await supabase.from('social_comments').update({
        replied_at: new Date().toISOString(), reply_text: message,
      }).eq('id', comment.id);
      return new Response(JSON.stringify({ success: true, reply_id: j.id }), { headers: corsHeaders });
    }
    if (action === 'hide') {
      const r = await fetch(`${GRAPH}/${comment.external_comment_id}`, {
        method: 'POST', body: new URLSearchParams({ is_hidden: 'true', access_token: token }),
      });
      const j = await r.json();
      if (j?.error) return new Response(JSON.stringify({ error: 'fb_api_error', fb_error: j.error }), { status: 400, headers: corsHeaders });
      await supabase.from('social_comments').update({ hidden_at: new Date().toISOString() }).eq('id', comment.id);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
    if (action === 'delete') {
      const r = await fetch(`${GRAPH}/${comment.external_comment_id}?access_token=${token}`, { method: 'DELETE' });
      const j = await r.json();
      if (j?.error) return new Response(JSON.stringify({ error: 'fb_api_error', fb_error: j.error }), { status: 400, headers: corsHeaders });
      await supabase.from('social_comments').delete().eq('id', comment.id);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
    return new Response(JSON.stringify({ error: 'invalid_action' }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
