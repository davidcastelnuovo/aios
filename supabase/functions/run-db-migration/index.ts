// Temporary one-shot migration runner.
// Runs the broadcast_wa_groups migration using the service role via rpc('run_ddl_once').
// SAFE TO DELETE after migration is confirmed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });

  const ddl = [
    `ALTER TABLE public.broadcast_recipients ADD COLUMN IF NOT EXISTS group_chat_id TEXT`,
    `ALTER TABLE public.broadcast_recipients DROP CONSTRAINT IF EXISTS broadcast_recipients_entity_type_check`,
    `ALTER TABLE public.broadcast_recipients ADD CONSTRAINT broadcast_recipients_entity_type_check CHECK (entity_type IN ('client', 'lead', 'campaigner', 'manual', 'wa_group'))`,
    `CREATE INDEX IF NOT EXISTS idx_br_group_chat_id ON public.broadcast_recipients(broadcast_id, group_chat_id) WHERE group_chat_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_br_broadcast_group ON public.broadcast_recipients(broadcast_id, group_chat_id) WHERE group_chat_id IS NOT NULL`,
  ];

  const results: { sql: string; result: string }[] = [];
  for (const sql of ddl) {
    const { data, error } = await db.rpc('run_ddl_once', { sql });
    results.push({ sql: sql.slice(0, 80), result: error ? error.message : (data || 'ok') });
  }

  return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: cors });
});
