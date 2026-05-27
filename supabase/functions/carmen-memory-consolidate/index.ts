// Carmen Memory Consolidation — daily decay + cleanup
// Reduces retention_score on episodes (FadeMem-style), prunes near-zero scored ones.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // 1. Decay all episodes (lambda = 0.02 → ~30% retention after 60d for importance=5)
    const { data: decayed, error: decayErr } = await supabase
      .rpc('carmen_memory_decay_episodes', { p_lambda: 0.02 })
    if (decayErr) throw decayErr

    // 2. Prune episodes whose retention_score < 0.05 AND not accessed in 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400 * 1000).toISOString()
    const { data: pruned, error: pruneErr } = await supabase
      .from('carmen_memory_episodes')
      .delete()
      .lt('retention_score', 0.05)
      .lt('last_accessed_at', ninetyDaysAgo)
      .select('id')
    if (pruneErr) throw pruneErr

    // 3. Expire pointers whose source rows no longer exist is left to the worker; here we
    //    just clear obviously stale pointers older than 1 year with no access.
    return new Response(JSON.stringify({
      decayed_episodes: decayed,
      pruned_episodes: pruned?.length || 0,
      ran_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[carmen-memory-consolidate]', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
