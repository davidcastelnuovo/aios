// broadcast-unsubscribe — public one-click unsubscribe endpoint linked in the
// footer of every broadcast email (legal requirement). Called via GET ?r=<recipient_id>
// or POST (List-Unsubscribe-Post one-click). Adds the recipient's email to
// broadcast_opt_outs and returns a small confirmation page.
//
// Deploy WITHOUT JWT verification (public link): supabase functions deploy
//   broadcast-unsubscribe --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const page = (msg: string) => `<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>הסרה מרשימת הדיוור</title>
<style>body{font-family:system-ui,Arial,sans-serif;background:#f6f7f9;color:#222;display:flex;
min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#fff;padding:32px 40px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);text-align:center;max-width:420px}
h1{font-size:20px;margin:0 0 8px}p{color:#555;margin:0}</style></head>
<body><div class="card"><h1>${msg}</h1><p>לא תקבל/י עוד דיוורים מהרשימה הזו.</p></div></body></html>`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const recipientId = url.searchParams.get('r');

  const html = (body: string, status = 200) =>
    new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  if (!recipientId) return html(page('קישור לא תקין'), 400);

  try {
    const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
    const { data: r } = await db
      .from('broadcast_recipients')
      .select('id, tenant_id, email, phone')
      .eq('id', recipientId)
      .maybeSingle();

    if (!r) return html(page('הקישור פג או לא נמצא'), 404);

    if (r.email) {
      await db.from('broadcast_opt_outs').upsert(
        { tenant_id: r.tenant_id, email: r.email, channel: 'email', source: 'email_unsubscribe' },
        { onConflict: 'tenant_id,email,channel', ignoreDuplicates: true },
      );
    }
    await db.from('broadcast_recipients').update({ status: 'opted_out' }).eq('id', r.id);

    return html(page('הוסרת בהצלחה ✓'));
  } catch (e) {
    console.error('[broadcast-unsubscribe]', e);
    return html(page('אירעה שגיאה, נסה/י שוב מאוחר יותר'), 500);
  }
});
