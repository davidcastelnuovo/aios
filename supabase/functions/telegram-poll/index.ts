import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

Deno.serve(async () => {
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), { status: 500 });

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) return new Response(JSON.stringify({ error: 'TELEGRAM_API_KEY not configured' }), { status: 500 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get all active PRIMARY bots (skip shared shadow records to avoid duplicate polling)
  const { data: bots, error: botsErr } = await supabase
    .from('telegram_bot_state')
    .select('*')
    .eq('is_active', true)
    .is('shared_from_state_id', null);

  if (botsErr) {
    return new Response(JSON.stringify({ error: botsErr.message }), { status: 500 });
  }

  if (!bots || bots.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: 'No active bots' }));
  }

  let totalProcessed = 0;

  // For now, poll for each bot sequentially (single connector = single bot)
  for (const bot of bots) {
    let currentOffset = bot.update_offset;

    while (true) {
      const elapsed = Date.now() - startTime;
      const remainingMs = MAX_RUNTIME_MS - elapsed;
      if (remainingMs < MIN_REMAINING_MS) break;

      const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
      if (timeout < 1) break;

      try {
        const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': TELEGRAM_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            offset: currentOffset,
            timeout,
            allowed_updates: ['message'],
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error(`Telegram API error for tenant ${bot.tenant_id}:`, data);
          break;
        }

        const updates = data.result ?? [];
        if (updates.length === 0) continue;

        const rows = updates
          .filter((u: any) => u.message)
          .map((u: any) => ({
            tenant_id: bot.tenant_id,
            update_id: u.update_id,
            chat_id: u.message.chat.id,
            text: u.message.text ?? null,
            direction: 'inbound',
            sender_name: [u.message.from?.first_name, u.message.from?.last_name].filter(Boolean).join(' ') || null,
            sender_username: u.message.from?.username ?? null,
            raw_update: u,
          }));

        if (rows.length > 0) {
          const { error: insertErr } = await supabase
            .from('telegram_messages')
            .upsert(rows, { onConflict: 'tenant_id,update_id' });

          if (insertErr) {
            console.error('Insert error:', insertErr.message);
            break;
          }
          totalProcessed += rows.length;

          // Trigger automations for each incoming message
          for (const row of rows) {
            if (!row.text) continue;
            try {
              await supabase.functions.invoke('trigger-automation', {
                body: {
                  trigger_type: 'telegram_message_received',
                  tenant_id: bot.tenant_id,
                  chat_id: String(row.chat_id),
                  telegram_chat_id: String(row.chat_id),
                  message_text: row.text,
                  text: row.text,
                  sender_name: row.sender_name,
                  sender_username: row.sender_username,
                  contact_name: row.sender_name,
                },
              });
            } catch (triggerErr) {
              console.error('Trigger automation error:', triggerErr);
            }
          }
        }

        const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
        const { error: offsetErr } = await supabase
          .from('telegram_bot_state')
          .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
          .eq('id', bot.id);

        if (offsetErr) {
          console.error('Offset update error:', offsetErr.message);
          break;
        }

        currentOffset = newOffset;
      } catch (err) {
        console.error('Poll error:', err);
        break;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed }));
});
