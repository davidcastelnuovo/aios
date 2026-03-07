import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
// Gmail API proxy v1

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function refreshTokenIfNeeded(supabaseService: any, tokenData: any) {
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt > new Date(Date.now() + 60000)) {
    return tokenData.access_token;
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await res.json();
  if (!tokens.access_token) throw new Error('Token refresh failed');

  const newExpires = new Date(Date.now() + (tokens.expires_in * 1000));
  await supabaseService
    .from('gmail_tokens')
    .update({
      access_token: tokens.access_token,
      expires_at: newExpires.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', tokenData.user_id);

  return tokens.access_token;
}

function parseEmailHeader(payload: any, headerName: string): string {
  const header = payload?.headers?.find((h: any) => h.name.toLowerCase() === headerName.toLowerCase());
  return header?.value || '';
}

function decodeBase64Utf8(base64url: string): string {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function getEmailBody(payload: any): string {
  if (payload.body?.data) {
    return decodeBase64Utf8(payload.body.data);
  }
  if (payload.parts) {
    // Prefer text/html, fallback to text/plain
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    const part = htmlPart || textPart;
    if (part?.body?.data) {
      return decodeBase64Utf8(part.body.data);
    }
    // Nested multipart
    for (const p of payload.parts) {
      if (p.parts) {
        const body = getEmailBody(p);
        if (body) return body;
      }
    }
  }
  return '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) throw new Error('No authorization header');

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get tokens
    const { data: tokenData, error: tokenError } = await serviceClient
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) throw new Error('Gmail not connected');

    const accessToken = await refreshTokenIfNeeded(serviceClient, tokenData);
    const body = await req.json();
    const { action } = body;

    // LIST messages
    if (action === 'list') {
      const { query, maxResults = 20, pageToken, labelIds } = body;
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('maxResults', String(maxResults));
      if (pageToken) params.set('pageToken', pageToken);
      if (labelIds) params.set('labelIds', labelIds);

      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Gmail API error');

      // Fetch metadata for each message
      const messages = data.messages || [];
      const detailed = await Promise.all(
        messages.slice(0, maxResults).map(async (msg: any) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          const msgData = await msgRes.json();
          return {
            id: msgData.id,
            threadId: msgData.threadId,
            snippet: msgData.snippet,
            labelIds: msgData.labelIds || [],
            from: parseEmailHeader(msgData.payload, 'From'),
            to: parseEmailHeader(msgData.payload, 'To'),
            subject: parseEmailHeader(msgData.payload, 'Subject'),
            date: parseEmailHeader(msgData.payload, 'Date'),
            isUnread: (msgData.labelIds || []).includes('UNREAD'),
          };
        })
      );

      return new Response(JSON.stringify({
        messages: detailed,
        nextPageToken: data.nextPageToken,
        resultSizeEstimate: data.resultSizeEstimate,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET single message
    if (action === 'get') {
      const { messageId } = body;
      if (!messageId) throw new Error('Missing messageId');

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const msgData = await res.json();
      if (!res.ok) throw new Error(msgData.error?.message || 'Gmail API error');

      return new Response(JSON.stringify({
        id: msgData.id,
        threadId: msgData.threadId,
        snippet: msgData.snippet,
        labelIds: msgData.labelIds || [],
        from: parseEmailHeader(msgData.payload, 'From'),
        to: parseEmailHeader(msgData.payload, 'To'),
        subject: parseEmailHeader(msgData.payload, 'Subject'),
        date: parseEmailHeader(msgData.payload, 'Date'),
        body: getEmailBody(msgData.payload),
        isUnread: (msgData.labelIds || []).includes('UNREAD'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SEND message
    if (action === 'send') {
      const { to, subject, body: emailBody, inReplyTo, threadId } = body;
      if (!to || !subject) throw new Error('Missing to or subject');

      let rawMessage = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n`;
      if (inReplyTo) {
        rawMessage += `In-Reply-To: ${inReplyTo}\r\nReferences: ${inReplyTo}\r\n`;
      }
      rawMessage += `\r\n${emailBody || ''}`;

      // Base64url encode
      const encoded = btoa(unescape(encodeURIComponent(rawMessage)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const sendBody: any = { raw: encoded };
      if (threadId) sendBody.threadId = threadId;

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Send failed');

      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // MARK as read/unread
    if (action === 'markRead' || action === 'markUnread') {
      const { messageId } = body;
      if (!messageId) throw new Error('Missing messageId');

      const modifications = action === 'markRead'
        ? { removeLabelIds: ['UNREAD'] }
        : { addLabelIds: ['UNREAD'] };

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(modifications),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Modify failed');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TRASH message
    if (action === 'trash') {
      const { messageId } = body;
      if (!messageId) throw new Error('Missing messageId');

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Trash failed');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('Gmail API error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
