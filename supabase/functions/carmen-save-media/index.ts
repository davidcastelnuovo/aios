// Carmen: save media from a chat message into the marketing media library.
// Input: { tenant_id, message_id?, media_url?, mime_type?, client_id?, lead_id?, caption?, tags? }
// If message_id given, pulls media URL from chat_messages.raw_provider_data; otherwise uses media_url directly.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const SUPPORTED_AD_MIME = new Set(['image/jpeg','image/jpg','image/png','image/webp','video/mp4','video/quicktime']);

function pickMediaFromRaw(raw: any): { url?: string; mime?: string; caption?: string } {
  if (!raw || typeof raw !== 'object') return {};
  // Manus/Green API common shapes
  const candidates = [
    raw?.media_url, raw?.mediaUrl, raw?.url, raw?.file_url, raw?.fileUrl,
    raw?.message?.imageMessage?.url, raw?.message?.videoMessage?.url,
    raw?.downloadUrl, raw?.downloadURL,
  ].filter(Boolean);
  const url = candidates[0];
  const mime = raw?.mime_type || raw?.mimeType || raw?.message?.imageMessage?.mimetype || raw?.message?.videoMessage?.mimetype;
  const caption = raw?.caption || raw?.message?.caption || raw?.text;
  return { url, mime, caption };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { tenant_id, message_id, media_url: directUrl, mime_type: directMime, client_id, lead_id, caption: capArg, tags, created_by } = body;

    if (!tenant_id) return new Response(JSON.stringify({ error: 'tenant_id required' }), { status: 400, headers: corsHeaders });

    let url: string | undefined = directUrl;
    let mime: string | undefined = directMime;
    let caption: string | undefined = capArg;
    let resolvedClientId = client_id;
    let resolvedLeadId = lead_id;
    let sourceMessageId: string | undefined = message_id;

    if (message_id) {
      const { data: msg } = await supabase
        .from('chat_messages')
        .select('id, tenant_id, client_id, lead_id, raw_provider_data, message_text')
        .eq('id', message_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle();
      if (!msg) return new Response(JSON.stringify({ error: 'message_not_found' }), { status: 404, headers: corsHeaders });
      const picked = pickMediaFromRaw(msg.raw_provider_data);
      url = url || picked.url;
      mime = mime || picked.mime;
      caption = caption || picked.caption || msg.message_text;
      resolvedClientId = resolvedClientId || msg.client_id;
      resolvedLeadId = resolvedLeadId || msg.lead_id;
      sourceMessageId = msg.id;
    }

    if (!url) return new Response(JSON.stringify({ error: 'no_media_url', message: 'לא נמצא קישור מדיה בהודעה' }), { status: 400, headers: corsHeaders });

    // Download the file
    const fileRes = await fetch(url);
    if (!fileRes.ok) return new Response(JSON.stringify({ error: 'download_failed', status: fileRes.status }), { status: 502, headers: corsHeaders });
    const blob = await fileRes.blob();
    if (!mime) mime = blob.type || 'application/octet-stream';
    const ext = (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';

    // Build path: {tenant_id}/{client_or_lead}/{timestamp}-{rand}.ext
    const subDir = resolvedClientId ? `clients/${resolvedClientId}` : (resolvedLeadId ? `leads/${resolvedLeadId}` : 'unassigned');
    const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const bucketPath = `${tenant_id}/${subDir}/${fileName}`;

    const { error: upErr } = await supabase.storage.from('carmen-media').upload(bucketPath, blob, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) return new Response(JSON.stringify({ error: 'upload_failed', details: upErr.message }), { status: 500, headers: corsHeaders });

    const adReady = SUPPORTED_AD_MIME.has(mime.toLowerCase());

    const { data: row, error: insErr } = await supabase
      .from('marketing_media_library')
      .insert({
        tenant_id,
        client_id: resolvedClientId || null,
        lead_id: resolvedLeadId || null,
        bucket_path: bucketPath,
        mime_type: mime,
        file_size: blob.size,
        source: 'whatsapp',
        source_message_id: sourceMessageId || null,
        caption: caption ? String(caption).slice(0, 1000) : null,
        tags: Array.isArray(tags) ? tags.slice(0, 20) : [],
        ad_ready: adReady,
        created_by: created_by || null,
      })
      .select('id, bucket_path, mime_type, file_size, ad_ready, client_id, lead_id')
      .single();
    if (insErr) {
      // best-effort cleanup
      await supabase.storage.from('carmen-media').remove([bucketPath]).catch(() => {});
      return new Response(JSON.stringify({ error: 'insert_failed', details: insErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      success: true,
      media_id: row.id,
      bucket_path: row.bucket_path,
      mime_type: row.mime_type,
      file_size: row.file_size,
      ad_ready: row.ad_ready,
      client_id: row.client_id,
      lead_id: row.lead_id,
    }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error('[carmen-save-media]', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: corsHeaders });
  }
});
